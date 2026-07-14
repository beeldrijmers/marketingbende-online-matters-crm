const REDACTED_VALUE = "[AFGESCHERMD]";

const CREDENTIAL_LABEL = [
  "wachtwoord",
  "password",
  "passphrase",
  "pincode",
  "pin",
  "gebruikersnaam",
  "username",
  "user\\s*name",
  "api[ _-]?key",
  "api[ _-]?token",
  "access[ _-]?token",
  "refresh[ _-]?token",
  "client[ _-]?secret",
  "secret(?:[ _-]?key)?",
  "private[ _-]?key",
  "authorization",
].join("|");

const assignmentPattern = new RegExp(
  `^["']?(${CREDENTIAL_LABEL})["']?(?:\\s*[:=]\\s*|\\s+is\\s+|\\s{2,})(.+)$`,
  "i",
);
const labelOnlyPattern = new RegExp(
  `^["']?(${CREDENTIAL_LABEL})["']?\\s*:?$`,
  "i",
);
const envAssignmentPattern =
  /^([A-Z][A-Z0-9_]*(?:PASSWORD|PASSPHRASE|SECRET|TOKEN|API_KEY|USERNAME|USER))\s*=\s*(.+)$/;

const getMarkdownPrefix = (line: string): string =>
  line.match(/^\s*(?:(?:[-*+]\s+)|(?:#{1,6}\s+))?/)?.[0] ?? "";

const normalizeLine = (line: string): string =>
  line
    .replace(/^\s*(?:(?:[-*+]\s+)|(?:#{1,6}\s+))?/, "")
    .replace(/\*|__|`/g, "")
    .trim();

const redactInlineSecrets = (line: string): string =>
  line
    // Credentials embedded in URLs, e.g. https://user:password@example.com.
    .replace(
      /\b([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+):([^@\s/]+)@/gi,
      `$1:${REDACTED_VALUE}@`,
    )
    // Secret-looking URL query parameters.
    .replace(
      /([?&](?:token|api[_-]?key|access[_-]?token|secret)=)[^&#\s)]+/gi,
      `$1${REDACTED_VALUE}`,
    )
    // Authorization headers or snippets pasted into prose.
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, `$1${REDACTED_VALUE}`);

// Trello descriptions are copied into CRM deals. Keep the useful project text,
// but remove recognizable credentials so a project-tracking integration never
// becomes a second plaintext password store.
export const redactSensitiveDescription = (description: string): string => {
  const lines = description.split("\n");
  const redactedLines: string[] = [];
  let redactNextValue = false;
  let insidePrivateKey = false;

  for (const line of lines) {
    if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(line)) {
      insidePrivateKey = true;
      redactedLines.push("[PRIVATE KEY AFGESCHERMD]");
      continue;
    }
    if (insidePrivateKey) {
      if (/-----END (?:[A-Z ]+ )?PRIVATE KEY-----/.test(line)) {
        insidePrivateKey = false;
      }
      continue;
    }

    if (redactNextValue) {
      if (line.trim() === "") {
        redactedLines.push(line);
        continue;
      }
      redactedLines.push(`${getMarkdownPrefix(line)}${REDACTED_VALUE}`);
      redactNextValue = false;
      continue;
    }

    const normalized = normalizeLine(line);
    const envAssignment = normalized.match(envAssignmentPattern);
    if (envAssignment) {
      redactedLines.push(
        `${getMarkdownPrefix(line)}${envAssignment[1]}=${REDACTED_VALUE}`,
      );
      continue;
    }

    const assignment = normalized.match(assignmentPattern);
    if (assignment) {
      redactedLines.push(
        `${getMarkdownPrefix(line)}${assignment[1]}: ${REDACTED_VALUE}`,
      );
      continue;
    }

    const labelOnly = normalized.match(labelOnlyPattern);
    if (labelOnly) {
      redactedLines.push(
        `${getMarkdownPrefix(line)}${labelOnly[1]}: ${REDACTED_VALUE}`,
      );
      redactNextValue = true;
      continue;
    }

    redactedLines.push(redactInlineSecrets(line));
  }

  return redactedLines.join("\n");
};
