import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

/**
 * What the client sees when they open a shared status update.
 *
 * No account, no CRM chrome, no navigation into the app: one page that answers
 * "where does my project stand". It fetches through the status_update edge
 * function, which resolves exactly one row by the token in the URL, so this page
 * can never show more than what was written to be shared.
 *
 * Styled on its own terms rather than with the app's tokens: the app is a dark
 * workbench for two people who live in it all day, and this is a light document
 * for someone who reads it once on a phone.
 */

interface SharedUpdate {
  title: string;
  body: string;
  sections: { heading: string; lines: string[] }[];
  companyName: string | null;
  senderName: string | null;
  sharedAt: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; update: SharedUpdate }
  | { kind: "gone"; message: string };

const DATE = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const StatusUpdatePage = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "gone", message: "Deze link bestaat niet (meer)." });
      return;
    }
    const controller = new AbortController();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/status_update?token=${encodeURIComponent(token)}`;

    fetch(url, {
      headers: { apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY ?? "" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          setState({
            kind: "gone",
            message:
              payload?.message ??
              "Deze update kon niet worden geladen. Vraag ons om een nieuwe link.",
          });
          return;
        }
        setState({ kind: "ready", update: payload as SharedUpdate });
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setState({
          kind: "gone",
          message:
            "Deze update kon niet worden geladen. Probeer het later nog eens.",
        });
      });

    return () => controller.abort();
  }, [token]);

  return (
    <main className="min-h-dvh bg-[#f7f7f9] px-5 py-10 text-[#1d2333] [color-scheme:light] sm:py-16">
      <div className="mx-auto w-full max-w-[38rem]">
        <header className="flex items-baseline justify-between gap-4 border-b-2 border-[#4f46e5] pb-3">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#4f46e5]">
            Kompas
          </span>
          {state.kind === "ready" ? (
            <span className="text-xs text-[#6b7280]">
              {DATE.format(new Date(state.update.sharedAt))}
            </span>
          ) : null}
        </header>

        {state.kind === "loading" ? (
          <p className="mt-10 flex items-center gap-2 text-sm text-[#6b7280]">
            <Loader2 className="size-4 animate-spin" />
            Even geduld, we halen de update op.
          </p>
        ) : null}

        {state.kind === "gone" ? (
          <div className="mt-10 flex items-start gap-3 rounded-xl border border-[#e5e7eb] bg-white p-5">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-[#b45309]" />
            <div>
              <p className="font-semibold">Niet beschikbaar</p>
              <p className="mt-1 text-sm leading-6 text-[#4b5563]">
                {state.message}
              </p>
            </div>
          </div>
        ) : null}

        {state.kind === "ready" ? (
          <article className="mt-8">
            <h1 className="text-2xl font-semibold leading-tight">
              {state.update.title.replace(/^Statusupdate\s+/, "")}
            </h1>
            {state.update.companyName ? (
              <p className="mt-1 text-sm text-[#6b7280]">
                Statusupdate voor {state.update.companyName}
              </p>
            ) : null}

            <div className="mt-8 space-y-6">
              {state.update.sections.length > 0 ? (
                state.update.sections.map((section) => (
                  <section key={section.heading}>
                    <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">
                      {section.heading}
                    </h2>
                    <ul className="mt-2 space-y-1.5">
                      {section.lines.map((line) => (
                        <li key={line} className="flex gap-2.5 leading-6">
                          <span
                            aria-hidden="true"
                            className="mt-2 size-1.5 shrink-0 rounded-full bg-[#4f46e5]"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              ) : (
                // A body without blocks still has to be readable.
                <p className="whitespace-pre-line leading-7">
                  {state.update.body}
                </p>
              )}
            </div>

            <footer className="mt-10 border-t border-[#e5e7eb] pt-4 text-sm text-[#4b5563]">
              Vragen of aanvullingen? Reageer op de mail waarin u deze link
              kreeg, dan pakken we het op.
              {state.update.senderName ? (
                <span className="mt-1 block">{state.update.senderName}</span>
              ) : null}
            </footer>
          </article>
        ) : null}
      </div>
    </main>
  );
};

StatusUpdatePage.path = "/status/:token";
