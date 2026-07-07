import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Atomically claims the right to send the "project afgerond" notification for a
// deal: it sets won_notified_at only while it is still null and reports whether
// THIS call is the one that set it. Because `UPDATE ... WHERE won_notified_at IS
// NULL` is atomic, concurrent or retried webhook deliveries (Trello is
// at-least-once) notify exactly once.
export const claimWonNotification = async (
  dealId: number,
): Promise<boolean> => {
  const { data, error } = await supabaseAdmin
    .from("deals")
    .update({ won_notified_at: new Date().toISOString() })
    .eq("id", dealId)
    .is("won_notified_at", null)
    .select("id");
  if (error) {
    console.error(
      `Could not claim won-notification for deal ${dealId}:`,
      error.message,
    );
    return false;
  }
  return (data?.length ?? 0) > 0;
};

// Gives the claim back when the notification could not actually be sent, so
// the one-shot is not burned by a transient Resend failure: the next webhook
// delivery (Trello is at-least-once) claims and tries again. Only called on a
// definitive send failure; in the rare case a send succeeded at Resend but
// reported a failure to us, the worst outcome is one duplicate e-mail — the
// right trade-off against never notifying at all.
export const releaseWonNotification = async (dealId: number): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("deals")
    .update({ won_notified_at: null })
    .eq("id", dealId);
  if (error) {
    console.error(
      `Could not release won-notification claim for deal ${dealId}:`,
      error.message,
    );
  }
};
