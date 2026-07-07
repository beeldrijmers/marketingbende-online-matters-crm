import { supabaseDataProvider } from "ra-supabase-core";
import {
  withLifecycleCallbacks,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  ContactNote,
  Deal,
  DealNote,
  RAFile,
  Sale,
  SalesFormData,
  SignUpData,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { ATTACHMENTS_BUCKET } from "../commons/attachments";
import {
  clearCurrentSaleCache,
  getIsInitialized,
  markInitializedCache,
} from "./authProvider";
import { getSupabaseClient } from "./supabase";

const getBaseDataProvider = () =>
  supabaseDataProvider({
    instanceUrl: import.meta.env.VITE_SUPABASE_URL,
    apiKey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
    supabaseClient: getSupabaseClient(),
    sortOrder: "asc,desc.nullslast" as any,
  });

const processCompanyLogo = async (params: any) => {
  const logo = params.data.logo;

  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
  }

  return {
    ...params,
    data: {
      ...params.data,
      logo,
    },
  };
};

const getDataProviderWithCustomMethods = () => {
  const baseDataProvider = getBaseDataProvider();

  return {
    ...baseDataProvider,
    async getList(resource: string, params: GetListParams) {
      if (resource === "companies") {
        return baseDataProvider.getList("companies_summary", params);
      }
      if (resource === "contacts") {
        return baseDataProvider.getList("contacts_summary", params);
      }
      if (resource === "activity_log") {
        const { data, total } = await baseDataProvider.getList(
          "activity_log",
          params,
        );
        // Rename snake_case view columns to camelCase to match Activity type
        return {
          data: data.map((row: any) => ({
            ...row,
            contactNote: row.contact_note ?? undefined,
            dealNote: row.deal_note ?? undefined,
            contact_note: undefined,
            deal_note: undefined,
          })),
          total,
        };
      }

      return baseDataProvider.getList(resource, params);
    },
    async getOne(resource: string, params: any) {
      if (resource === "companies") {
        return baseDataProvider.getOne("companies_summary", params);
      }
      if (resource === "contacts") {
        return baseDataProvider.getOne("contacts_summary", params);
      }

      return baseDataProvider.getOne(resource, params);
    },
    // Same view mapping for reference lists (e.g. the contacts tab on a
    // company): components can keep using the base resource name, so ra-core's
    // cache invalidation after create/update/delete on that resource works.
    async getManyReference(resource: string, params: any) {
      if (resource === "companies") {
        return baseDataProvider.getManyReference("companies_summary", params);
      }
      if (resource === "contacts") {
        return baseDataProvider.getManyReference("contacts_summary", params);
      }

      return baseDataProvider.getManyReference(resource, params);
    },

    async signUp({ email, password, first_name, last_name }: SignUpData) {
      const response = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name,
            last_name,
          },
        },
      });

      if (!response.data?.user || response.error) {
        console.error("signUp.error", response.error);
        throw new Error(response?.error?.message || "Failed to create account");
      }

      // Update the is-initialized cache (the real localStorage-backed one).
      markInitializedCache();

      return {
        id: response.data.user.id,
        email,
        password,
      };
    },
    async salesCreate(body: SalesFormData) {
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: Sale;
      }>("users", {
        method: "POST",
        body,
      });

      if (!data || error) {
        console.error("salesCreate.error", error);
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        throw new Error(errorDetails?.message || "Failed to create the user");
      }

      return data.data;
    },
    async salesUpdate(
      id: Identifier,
      data: Partial<Omit<SalesFormData, "password">>,
    ) {
      const {
        email,
        first_name,
        last_name,
        administrator,
        avatar,
        disabled,
        partij,
      } = data;

      const { data: updatedData, error } =
        await getSupabaseClient().functions.invoke<{
          data: Sale;
        }>("users", {
          method: "PATCH",
          body: {
            sales_id: id,
            email,
            first_name,
            last_name,
            administrator,
            disabled,
            avatar,
            partij,
          },
        });

      if (!updatedData || error) {
        console.error("salesUpdate.error", error);
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        throw new Error(
          errorDetails?.message || "Failed to update account manager",
        );
      }

      // The auth layer caches the current user's sales record; a profile edit
      // (own name/avatar, or an admin changing roles) must invalidate it or
      // getIdentity keeps serving the old values until logout.
      clearCurrentSaleCache();

      return updatedData.data;
    },
    async updatePassword(id: Identifier) {
      const { data: passwordUpdated, error } =
        await getSupabaseClient().functions.invoke<boolean>("update_password", {
          method: "PATCH",
          body: {
            sales_id: id,
          },
        });

      if (!passwordUpdated || error) {
        console.error("update_password.error", error);
        throw new Error("Failed to update password");
      }

      return passwordUpdated;
    },
    async unarchiveDeal(deal: Deal) {
      // Only the unarchived deal itself is written: it goes back on top of
      // its column by taking an index below the current minimum. The previous
      // implementation re-indexed EVERY deal in the stage with up to 1000
      // parallel PATCHes — racing concurrent kanban drags and leaving the
      // column half re-indexed when one of them failed. The board sorts by
      // index and tolerates gaps/duplicates, so a single write is enough.
      const { data: topDeals } = await baseDataProvider.getList<Deal>("deals", {
        filter: { stage: deal.stage },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "index", order: "ASC" },
      });
      const minIndex = topDeals.at(0)?.index ?? 1;

      return await baseDataProvider.update("deals", {
        id: deal.id,
        data: { index: minIndex - 1, archived_at: null },
        previousData: deal,
      });
    },
    async isInitialized() {
      return getIsInitialized();
    },
    async mergeContacts(sourceId: Identifier, targetId: Identifier) {
      const { data, error } = await getSupabaseClient().functions.invoke(
        "merge_contacts",
        {
          method: "POST",
          body: { loserId: sourceId, winnerId: targetId },
        },
      );

      if (error) {
        console.error("merge_contacts.error", error);
        throw new Error("Failed to merge contacts");
      }

      return data;
    },
    async getMoneybirdTaxRates() {
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: { id: string; name: string; percentage: string }[];
      }>("moneybird_estimate", {
        method: "GET",
      });

      if (!data || error) {
        console.error("moneybird_estimate.getTaxRates.error", error);
        throw new Error("Failed to load Moneybird tax rates");
      }

      return data.data;
    },
    // The caller's own Moneybird connection status. Reads the table directly:
    // RLS restricts it to the caller's own row and column-level grants hide the
    // encrypted token, so "select=*" would be denied; request the readable
    // columns explicitly.
    async getMoneybirdConnection() {
      const { data, error } = await getSupabaseClient()
        .from("moneybird_connections")
        .select(
          "id, sales_id, administration_id, administration_name, created_at, updated_at",
        )
        .maybeSingle();

      if (error) {
        console.error("moneybird_connections.get.error", error);
        throw new Error("Failed to load the Moneybird connection");
      }

      return data
        ? {
            administrationId: data.administration_id as string,
            administrationName: data.administration_name as string,
          }
        : null;
    },
    // Validates the personal API token live against Moneybird and stores it
    // encrypted. When the token can access several administrations the edge
    // function answers 409 with the list; we surface it so the UI can show a
    // picker and retry with an explicit administrationId.
    async connectMoneybird(params: {
      apiToken: string;
      administrationId?: string;
    }) {
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: { administrationId: string; administrationName: string };
      }>("moneybird_connection", {
        method: "POST",
        body: {
          apiToken: params.apiToken,
          administrationId: params.administrationId,
        },
      });

      if (!data || error) {
        // Deliberately NOT logging the error context here: the request body
        // contains the plaintext API token.
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        const failure = new Error(
          errorDetails?.message || "Failed to connect Moneybird",
        ) as Error & {
          administrations?: { id: string; name: string }[];
        };
        if (Array.isArray(errorDetails?.administrations)) {
          failure.administrations = errorDetails.administrations;
        }
        throw failure;
      }

      return data.data;
    },
    async disconnectMoneybird() {
      const { error } = await getSupabaseClient().functions.invoke(
        "moneybird_connection",
        { method: "DELETE" },
      );

      if (error) {
        console.error("moneybird_connection.disconnect.error", error);
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        throw new Error(
          errorDetails?.message || "Failed to disconnect Moneybird",
        );
      }
    },
    async createMoneybirdDocument(
      kind: "estimate" | "invoice",
      params: {
        dealId: Identifier;
        taxRateId: string;
        description: string;
      },
    ) {
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: { documentId: string; status: string; alreadyExisted: boolean };
      }>(`moneybird_${kind}`, {
        method: "POST",
        body: {
          dealId: params.dealId,
          taxRateId: params.taxRateId,
          description: params.description,
        },
      });

      if (!data || error) {
        console.error(`moneybird_${kind}.create.error`, error);
        // The edge function returns a useful message (e.g. a 409 "already in
        // progress" or a Moneybird validation error); surface it to the UI.
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        throw new Error(
          errorDetails?.message || `Failed to create Moneybird ${kind}`,
        );
      }

      return data.data;
    },
    // Writes a completed/reopened Trello-synced step back to its Trello card, so
    // ticking a step off in the CRM ticks it off in Trello too.
    async completeTrelloStep(taskId: Identifier, complete: boolean) {
      const { error } = await getSupabaseClient().functions.invoke(
        "trello-checkitem",
        { method: "POST", body: { taskId, complete } },
      );
      if (error) {
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        throw new Error(
          errorDetails?.message || "Kon de stap niet naar Trello bijwerken",
        );
      }
    },
    // Pull every Trello card into the CRM on demand (the "Synchroniseer Trello"
    // button). The edge function runs the full, idempotent sync and returns a
    // summary of what it touched.
    async syncTrelloCards() {
      const { data, error } = await getSupabaseClient().functions.invoke<{
        data: {
          cardCount: number;
          synced: number;
          totalComments: number;
          totalAttachments: number;
          archivedAttachments: number;
        };
      }>("trello-sync", {
        method: "POST",
        body: { trigger: "sync_all" },
      });
      if (!data || error) {
        console.error("trello-sync.sync_all.error", error);
        const errorDetails = await (async () => {
          try {
            return (await error?.context?.json()) ?? {};
          } catch {
            return {};
          }
        })();
        throw new Error(
          errorDetails?.message || "Synchroniseren met Trello is mislukt",
        );
      }
      return data.data;
    },
    async getConfiguration(): Promise<ConfigurationContextValue> {
      const { data } = await baseDataProvider.getOne("configuration", {
        id: 1,
      });
      return (data?.config as ConfigurationContextValue) ?? {};
    },
    async updateConfiguration(
      config: ConfigurationContextValue,
    ): Promise<ConfigurationContextValue> {
      const { data } = await baseDataProvider.update("configuration", {
        id: 1,
        data: { config },
        previousData: { id: 1 },
      });
      return data.config as ConfigurationContextValue;
    },
  } satisfies DataProvider;
};

export type CrmDataProvider = ReturnType<
  typeof getDataProviderWithCustomMethods
>;

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
    return logo.src;
  }
  return logo?.src ?? "";
};

const lifeCycleCallbacks: ResourceCallbacks[] = [
  {
    resource: "configuration",
    beforeUpdate: async (params) => {
      const config = params.data.config;
      if (config) {
        config.lightModeLogo = await processConfigLogo(config.lightModeLogo);
        config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
      }
      return params;
    },
  },
  {
    resource: "contact_notes",
    beforeSave: async (data: ContactNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_notes",
    beforeSave: async (data: DealNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "sales",
    beforeSave: async (data: Sale, _, __) => {
      if (data.avatar) {
        await uploadToBucket(data.avatar);
      }
      return data;
    },
  },
  {
    resource: "contacts",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "first_name",
        "last_name",
        "company_name",
        "title",
        "email",
        "phone",
        "background",
      ])(params);
    },
  },
  {
    resource: "companies",
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "name",
        "phone_number",
        "website",
        "zipcode",
        "city",
        "state_abbr",
      ])(params);
    },
    beforeCreate: async (params) => {
      const createParams = await processCompanyLogo(params);

      return {
        ...createParams,
        data: {
          created_at: new Date().toISOString(),
          ...createParams.data,
        },
      };
    },
    beforeUpdate: async (params) => {
      return await processCompanyLogo(params);
    },
  },
  {
    resource: "contacts_summary",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["first_name", "last_name"])(params);
    },
  },
  {
    resource: "deals",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["name", "category", "description"])(params);
    },
  },
];

export const getDataProvider = () => {
  if (import.meta.env.VITE_SUPABASE_URL === undefined) {
    throw new Error("Please set the VITE_SUPABASE_URL environment variable");
  }
  if (import.meta.env.VITE_SB_PUBLISHABLE_KEY === undefined) {
    throw new Error(
      "Please set the VITE_SB_PUBLISHABLE_KEY environment variable",
    );
  }
  return withLifecycleCallbacks(
    getDataProviderWithCustomMethods(),
    lifeCycleCallbacks,
  ) as CrmDataProvider;
};

const applyFullTextSearch = (columns: string[]) => (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  // PostgREST-reserved characters would corrupt the or=(...) expression the
  // adapter builds (HTTP 400 on e.g. "Bakker (Amsterdam)" or "Jansen,P.").
  // They can't be escaped inside that expression, so they become word
  // separators instead — the adapter already splits the term on whitespace
  // into one ilike-per-word.
  const sanitizedQ = q.replace(/[,()"\\]/g, " ").trim();
  if (!sanitizedQ) {
    return { ...params, filter };
  }
  return {
    ...params,
    filter: {
      ...filter,
      "@or": columns.reduce((acc, column) => {
        if (column === "email")
          return {
            ...acc,
            [`email_fts@ilike`]: sanitizedQ,
          };
        if (column === "phone")
          return {
            ...acc,
            [`phone_fts@ilike`]: sanitizedQ,
          };
        else
          return {
            ...acc,
            [`${column}@ilike`]: sanitizedQ,
          };
      }, {}),
    },
  };
};

const uploadToBucket = async (fi: RAFile) => {
  if (!fi.src.startsWith("blob:") && !fi.src.startsWith("data:")) {
    // Sign URL check if path exists in the bucket
    if (fi.path) {
      const { error } = await getSupabaseClient()
        .storage.from(ATTACHMENTS_BUCKET)
        .createSignedUrl(fi.path, 60);

      if (!error) {
        return fi;
      }
    }
  }

  const dataContent = fi.src
    ? await fetch(fi.src)
        .then((res) => {
          if (res.status !== 200) {
            return null;
          }
          return res.blob();
        })
        .catch(() => null)
    : fi.rawFile;

  if (dataContent == null) {
    // We weren't able to download the file from its src (e.g. user must be signed in on another website to access it)
    // or the file has no content (not probable)
    // In that case, just return it as is: when trying to download it, users should be redirected to the other website
    // and see they need to be signed in. It will then be their responsibility to upload the file back to the note.
    return fi;
  }

  const file = fi.rawFile;
  const fileParts = file.name.split(".");
  const fileExt = fileParts.length > 1 ? `.${file.name.split(".").pop()}` : "";
  const fileName = `${Math.random()}${fileExt}`;
  const filePath = `${fileName}`;
  const { error: uploadError } = await getSupabaseClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .upload(filePath, dataContent);

  if (uploadError) {
    console.error("uploadError", uploadError);
    throw new Error("Failed to upload attachment");
  }

  const { data } = getSupabaseClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .getPublicUrl(filePath);

  fi.path = filePath;
  fi.src = data.publicUrl;

  // save MIME type
  const mimeType = file.type;
  fi.type = mimeType;

  return fi;
};
