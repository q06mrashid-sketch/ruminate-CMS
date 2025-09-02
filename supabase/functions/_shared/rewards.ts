import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function applyStampAccrual(prevStamps: number, delta: number) {
  const start = Math.max(0, Number(prevStamps || 0));
  const inc = Math.max(0, Number(delta || 0));
  const total = start + inc;
  return {
    vouchersEarned: Math.floor(total / 8),
    stampsRemainder: total % 8,
  };
}

export async function getProfileRewards(admin: SupabaseClient, userId: string) {
  // Determine profiles primary key column
  let pk = "id";
  const { error: userIdColErr } = await admin
    .from("profiles")
    .select("user_id")
    .limit(1);
  if (!userIdColErr) {
    pk = "user_id";
  } else {
    const { error: idColErr } = await admin
      .from("profiles")
      .select("id")
      .limit(1);
    if (idColErr) throw idColErr;
  }

  const { data, error } = await admin
    .from("profiles")
    .select("loyalty_stamps, free_drinks")
    .eq(pk, userId)
    .single();
  if (error) throw error;

  return {
    loyaltyStamps: Number(data?.loyalty_stamps ?? 0),
    vouchers: Number(data?.free_drinks ?? 0),
  };
}
