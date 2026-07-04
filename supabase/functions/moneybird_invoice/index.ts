import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveMoneybirdDocument } from "../_shared/moneybird/handler.ts";

// All logic lives in the shared handler; estimates and invoices differ only by
// the document kind (endpoint, DB columns, reference prefix).
serveMoneybirdDocument("invoice");
