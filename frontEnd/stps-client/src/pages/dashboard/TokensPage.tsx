import { useEffect, useState } from "react";
import type { ApiToken } from "../../types/stps";

const DOCS_URL = "https://miguelclaret.github.io/STPS/docs";
const SDK_URL = "https://www.npmjs.com/package/stps-sdk";

type TokensPageProps = {
  tokens: ApiToken[];
  creating: boolean;
  revokingId: string | null;
  draftLabel: string;
  revealedToken: string | null;
  onDraftLabelChange: (value: string) => void;
  onCreateToken: () => void;
  onDismissRevealedToken: () => void;
  onRevokeToken: (tokenId: string) => void;
};

export function TokensPage({
  tokens,
  creating,
  revokingId,
  draftLabel,
  revealedToken,
  onDraftLabelChange,
  onCreateToken,
  onDismissRevealedToken,
  onRevokeToken,
}: TokensPageProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopyRevealedToken = async () => {
    if (!revealedToken) return;
    try {
      await navigator.clipboard.writeText(revealedToken);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tokens</p>
          <h1>SDK access tokens</h1>
          <p>
            Generate persistent account tokens for the SDK. The raw token is
            shown once at creation time, then only metadata remains available in
            the workspace.
          </p>
        </div>
      </div>

      <section className="token-layout">
        <form
          className="token-create"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateToken();
          }}
        >
          <div className="section-title">
            <span>Create token</span>
            <strong>SDK access</strong>
          </div>
          <p className="token-create__copy">
            Use a label to identify where this token will run, for example CI,
            backend or internal monitor.
          </p>
          <label>
            <span>Token label</span>
            <input
              type="text"
              placeholder="Optional label"
              value={draftLabel}
              onChange={(event) => onDraftLabelChange(event.target.value)}
              disabled={creating}
            />
          </label>
          <button
            type="submit"
            className="primary-inline-button"
            disabled={creating}
          >
            {creating ? "Creating..." : "Create token"}
          </button>
        </form>

        <div className="token-guide">
          <div className="section-title">
            <span>Usage</span>
            <strong>stps-sdk</strong>
          </div>
          <pre className="token-code-block">
            <code>{`import { StpsClient } from "stps-sdk";

const client = new StpsClient({
  token: process.env.STPS_API_TOKEN!,
});`}</code>
          </pre>
          <p className="token-guide__copy">
            Tokens stay attached to this account until you revoke them. Use them
            only in trusted environments.
          </p>
          <a
            className="token-guide__link"
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open STPS docs
          </a>
          <a
            className="token-guide__link"
            href={SDK_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open SDK package
          </a>
        </div>
      </section>

      {revealedToken ? (
        <section className="token-reveal" aria-label="Newly created token">
          <div className="token-reveal__head">
            <div>
              <p className="eyebrow">Created now</p>
              <h2>Copy this token now</h2>
            </div>
            <button
              type="button"
              className="page-action"
              onClick={onDismissRevealedToken}
            >
              Dismiss
            </button>
          </div>
          <p className="token-reveal__copy">
            This is the only time STPS shows the raw token value. After you
            dismiss it, the dashboard keeps only the metadata.
          </p>
          <div className="token-reveal__value">
            <code>{revealedToken}</code>
          </div>
          <button
            type="button"
            className="page-action"
            onClick={() => void handleCopyRevealedToken()}
          >
            {copied ? "Copied" : "Copy token"}
          </button>
        </section>
      ) : null}

      <section className="token-list-section" aria-label="Active SDK tokens">
        <div className="section-title">
          <span>Active tokens</span>
          <strong>{tokens.length}</strong>
        </div>
        {tokens.length > 0 ? (
          <div className="token-list">
            {tokens.map((token) => (
              <article className="token-card" key={token.id}>
                <div className="token-card__head">
                  <div>
                    <span className="eyebrow">Token label</span>
                    <strong>{token.label ?? "Unlabeled token"}</strong>
                  </div>
                  <button
                    type="button"
                    className="token-card__danger"
                    disabled={revokingId === token.id}
                    onClick={() => onRevokeToken(token.id)}
                  >
                    {revokingId === token.id ? "Revoking..." : "Revoke"}
                  </button>
                </div>
                <dl className="token-card__meta">
                  <div>
                    <dt>Created</dt>
                    <dd>{token.createdAt}</dd>
                  </div>
                  <div>
                    <dt>Last used</dt>
                    <dd>{token.lastUsedAt ?? "Not used yet"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No SDK token created</strong>
            <p>
              Create the first token to let an external service read the
              protocols attached to this account.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
