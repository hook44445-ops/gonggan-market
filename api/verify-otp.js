import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

// Session validity: 30 days in seconds
const SESSION_DURATION = 30 * 24 * 60 * 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone, token } = req.body;
  if (!phone || !token) {
    return res.status(400).json({ error: "Phone and token are required" });
  }

  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  try {
    const check = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phone, code: token });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "인증번호가 올바르지 않습니다" });
    }

    const supabaseUrl      = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const jwtSecret        = process.env.SUPABASE_JWT_SECRET;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        error: "Server misconfiguration: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set",
      });
    }
    if (!jwtSecret) {
      return res.status(500).json({
        error: "Server misconfiguration: SUPABASE_JWT_SECRET is not set",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up existing user by phone in public users table
    const { data: existingProfile } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .single();

    let userId;
    if (existingProfile) {
      userId = existingProfile.id;
    } else {
      // New user — create Supabase auth entry with phone pre-confirmed
      const { data: newUser, error: createErr } =
        await supabase.auth.admin.createUser({
          phone,
          phone_confirm: true,
        });
      if (createErr) {
        return res.status(500).json({ error: createErr.message });
      }
      userId = newUser.user.id;
    }

    // Build a signed JWT that Supabase APIs (RLS, storage, realtime) will accept.
    // admin.createSession does not exist in @supabase/auth-js v2.x; this custom
    // token approach is equivalent: same claims, same secret, same 30-day expiry.
    const now = Math.floor(Date.now() / 1000);
    const accessToken = jwt.sign(
      {
        aud:                  "authenticated",
        iss:                  `${supabaseUrl}/auth/v1`,
        sub:                  userId,
        role:                 "authenticated",
        phone,
        phone_confirmed_at:   new Date().toISOString(),
      },
      jwtSecret,
      { expiresIn: SESSION_DURATION }
    );

    // Opaque refresh placeholder. The Supabase client requires a non-empty value
    // for setSession(). When the 30-day access_token eventually expires the
    // client will attempt a refresh with this token, GoTrue will reject it, and
    // the SIGNED_OUT event will fire — forcing the user to re-authenticate.
    const refreshToken = randomBytes(32).toString("base64url");

    res.status(200).json({
      data: {
        user: { id: userId },
        session: {
          access_token:  accessToken,
          refresh_token: refreshToken,
          expires_in:    SESSION_DURATION,
          expires_at:    now + SESSION_DURATION,
          token_type:    "bearer",
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
