import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

/**
 * Get or create the FreeStockAlerts broadcast audience in Resend.
 * Caches the audience ID in RESEND_AUDIENCE_ID env var if set,
 * otherwise looks it up / creates it.
 */
export async function getAudienceId(): Promise<string> {
  // Use cached env var if available
  if (process.env.RESEND_AUDIENCE_ID) {
    return process.env.RESEND_AUDIENCE_ID;
  }

  // Check if audience already exists
  const { data: audiences } = await resend.audiences.list();
  const existing = audiences?.data?.find(
    (a: { name: string }) => a.name === "FreeStockAlerts Users"
  );
  if (existing) return existing.id;

  // Create it
  const { data: created } = await resend.audiences.create({
    name: "FreeStockAlerts Users",
  });
  if (!created) throw new Error("Failed to create Resend audience");
  return created.id;
}

/**
 * Add a contact to the broadcast audience.
 * Returns the Resend contact ID.
 */
export async function addContactToAudience(
  email: string,
  firstName?: string | null
): Promise<string | null> {
  try {
    const audienceId = await getAudienceId();
    const { data } = await resend.contacts.create({
      audienceId,
      email,
      firstName: firstName ?? undefined,
      unsubscribed: false,
    });
    return data?.id ?? null;
  } catch (error) {
    console.error("[Audience] Failed to add contact:", email, error);
    return null;
  }
}

/**
 * Remove (unsubscribe) a contact from the broadcast audience.
 */
export async function unsubscribeContact(contactId: string): Promise<void> {
  try {
    const audienceId = await getAudienceId();
    await resend.contacts.update({
      audienceId,
      id: contactId,
      unsubscribed: true,
    });
  } catch (error) {
    console.error("[Audience] Failed to unsubscribe contact:", contactId, error);
  }
}

/**
 * Remove a contact entirely from the audience.
 */
export async function removeContact(contactId: string): Promise<void> {
  try {
    const audienceId = await getAudienceId();
    await resend.contacts.remove({
      audienceId,
      id: contactId,
    });
  } catch (error) {
    console.error("[Audience] Failed to remove contact:", contactId, error);
  }
}
