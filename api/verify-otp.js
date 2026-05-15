import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

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

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        error: "Server misconfiguration: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set",
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

    // Create a real Supabase session so the frontend can call setSession()
    const { data: sessionData, error: sessionErr } =
      await supabase.auth.admin.createSession({ user_id: userId });
    if (sessionErr) {
      return res.status(500).json({ error: sessionErr.message });
    }

    res.status(200).json({
      data: {
        user: { id: userId },
        session: {
          access_token:  sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_in:    sessionData.session.expires_in,
          expires_at:    sessionData.session.expires_at,
          token_type:    sessionData.session.token_type ?? "bearer",
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
