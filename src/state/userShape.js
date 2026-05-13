// Canonical user object shape — prepared for Supabase OTP auth migration.
// setCurrentUser(null) on logout; populate on login/session restore.
//
// {
//   id:          string,   // Supabase auth user UUID
//   role:        "consumer" | "company",
//   phone:       string,   // E.164 format, e.g. "+821012345678"
//   name:        string,
//   verified:    boolean,  // phone OTP verified
//   badge:       "basic" | "standard" | "premium" | "enterprise" | "signature" | null,
//   regions:     string[], // service regions (company only)
//   specialties: string[], // specialty types (company only)
// }

export const EMPTY_USER = {
  id: null,
  role: null,
  phone: "",
  name: "",
  verified: false,
  badge: null,
  regions: [],
  specialties: [],
};
