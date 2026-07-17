import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import type { Attachment } from "./extractAndUploadAttachments.ts";
import { MAIL_PROVIDERS } from "./mailProvider.const.ts";

export const getOrCreateCompanyFromDomain = async ({
  domain,
  salesId,
  companyName,
  website,
}: {
  domain: string;
  salesId: number;
  companyName: string;
  website: string;
}) => {
  if (MAIL_PROVIDERS.includes(domain)) {
    // We don't want to create companies for generic mail providers, as they are not really companies and it would pollute the database with useless entries.
    return null;
  }

  // Check if the company already exists
  const { data: existingCompany, error: fetchCompanyError } =
    await supabaseAdmin
      .from("companies")
      .select("*")
      .or(`website.eq.${website},name.eq.${companyName},name.eq.${domain}`)
      .maybeSingle();
  if (fetchCompanyError) {
    throw new Error(
      `Could not fetch companies from database, name: ${domain}, error: ${fetchCompanyError.message}`,
    );
  }

  if (existingCompany) {
    return existingCompany;
  }

  const { data: newCompanies, error: createCompanyError } = await supabaseAdmin
    .from("companies")
    .insert({ name: companyName, sales_id: salesId, website })
    .select();
  if (createCompanyError) {
    throw new Error(
      `Could not create company in database, domain: ${domain}, error: ${createCompanyError.message}`,
    );
  }
  return newCompanies[0];
};

export const getOrCreateContactFromEmailInfo = async ({
  email,
  firstName,
  lastName,
  salesId,
  domain,
  companyName,
  website,
  createIfMissing = true,
}: {
  email: string;
  firstName: string;
  lastName: string;
  salesId: number;
  domain: string;
  companyName: string;
  website: string;
  /** Explicit BCC/forwarding may create; Gmail sync may only match known CRM contacts. */
  createIfMissing?: boolean;
}) => {
  // Check if the contact already exists
  const { data: existingContact, error: fetchContactError } =
    await supabaseAdmin
      .from("contacts")
      .select("*")
      .contains("email_jsonb", JSON.stringify([{ email }]))
      .maybeSingle();
  if (fetchContactError) {
    throw new Error(
      `Could not fetch contact from database, email: ${email}, error: ${fetchContactError.message}`,
    );
  }

  if (existingContact) {
    return existingContact;
  }

  if (!createIfMissing) return null;

  const company = await getOrCreateCompanyFromDomain({
    domain,
    salesId,
    companyName,
    website,
  });

  // Create the contact
  const { data: newContacts, error: createContactError } = await supabaseAdmin
    .from("contacts")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email_jsonb: [{ email, type: "Work" }],
      company_id: company ? company.id : null,
      sales_id: salesId,
      first_seen: new Date(),
      last_seen: new Date(),
      tags: [],
    })
    .select();
  if (createContactError || !newContacts[0]) {
    throw new Error(
      `Could not create contact in database, email: ${email}, error: ${createContactError?.message}`,
    );
  }
  return newContacts[0];
};

export const addNoteToContact = async ({
  salesEmail,
  email,
  domain,
  firstName,
  lastName,
  noteContent,
  attachments,
  companyName,
  website,
  createIfMissing = true,
  sourceEventId,
}: {
  salesEmail: string;
  email: string;
  domain: string;
  firstName: string;
  lastName: string;
  noteContent: string;
  attachments: Attachment[];
  companyName: string;
  website: string;
  createIfMissing?: boolean;
  /** Provider-level idempotency/grouping key, e.g. gmail:<mailbox>:<message>. */
  sourceEventId?: string;
}) => {
  const { data: sales, error: fetchSalesError } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("email", salesEmail)
    .neq("disabled", true)
    .maybeSingle();

  if (fetchSalesError) {
    return new Response(
      `Could not fetch sales from database, email: ${salesEmail}`,
      { status: 500 },
    );
  }
  if (!sales) {
    // Return a 403 to let Postmark know that it's no use to retry this request
    // https://postmarkapp.com/developer/webhooks/inbound-webhook#errors-and-retries
    return new Response(
      `Unable to find (active) sales in database, email: ${salesEmail}`,
      { status: 403 },
    );
  }

  let contact;
  try {
    contact = await getOrCreateContactFromEmailInfo({
      email,
      firstName,
      lastName,
      salesId: sales.id,
      domain,
      companyName,
      website,
      createIfMissing,
    });
  } catch (error) {
    console.error(
      "Error in getOrCreateContactFromEmailInfo for email:",
      email,
      "sales:",
      salesEmail,
      "error:",
      error,
    );
    return new Response(
      `Could not get or create contact from database, email: ${email}, sales: ${salesEmail}`,
      { status: 500 },
    );
  }
  if (!contact) return;

  // Add note to contact
  const { error: createNoteError } = await supabaseAdmin
    .from("contact_notes")
    .insert({
      contact_id: contact.id,
      text: noteContent,
      sales_id: sales.id,
      attachments,
      ...(sourceEventId ? { source_event_id: sourceEventId } : {}),
    });
  if (sourceEventId && createNoteError?.code === "23505") return;
  if (createNoteError) {
    return new Response(
      `Could not add note to contact ${email}, sales ${salesEmail}`,
      { status: 500 },
    );
  }

  await supabaseAdmin
    .from("contacts")
    .update({ last_seen: new Date() })
    .eq("id", contact.id);
};
