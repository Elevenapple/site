import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileUp,
  LoaderCircle,
  X,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_BYTES,
  MAX_FILES,
  buildRoleInput,
  extractRoleFile,
  getRoleFileKey,
} from './file-extraction';
import type {
  EvidenceProvenance,
  FitApiError,
  FitApiErrorCode,
  FitBrief,
  FitEvidence,
  FitEvidenceSource,
  RoleRequirement,
} from './types';

const MIN_ROLE_LENGTH = 250;
const MAX_ROLE_LENGTH = 12_000;
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const PROVENANCE_LABELS: Record<EvidenceProvenance, string> = {
  'ahmed-published-claim': 'Ahmed’s own account',
  'public-artifact': 'Public artifact',
  'public-contribution-record': 'Public contribution record',
  'public-authorship-record': 'Public authorship record',
};

const PRIORITY_LABELS: Record<RoleRequirement['priority'], string> = {
  required: 'Required',
  preferred: 'Preferred',
  inferred: 'Inferred priority',
};

const API_ERROR_MESSAGES: Partial<Record<FitApiErrorCode, string>> = {
  'invalid-input':
    'This does not look like a complete role description. Include the responsibilities and requirements, then try again.',
  'forbidden-origin':
    'This comparison can only be started from Ahmed’s portfolio.',
  'rate-limited':
    'You’ve reached the demo limit for now. Try again later or read Ahmed’s résumé.',
  'generation-failed':
    'The comparison did not finish. Try again or read Ahmed’s résumé.',
  'provider-timeout':
    'The comparison took too long to finish. Try again in a moment.',
};

type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; brief: FitBrief }
  | { status: 'error'; message: string };

type RoleFileState = {
  file: File;
  id: string;
  fingerprint: string;
  status: 'reading' | 'ready' | 'error';
  text: string;
  error?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) {
    return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  }

  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

const MAX_FILE_SIZE_LABEL = `${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isProvenance(value: unknown): value is EvidenceProvenance {
  return (
    value === 'ahmed-published-claim' ||
    value === 'public-artifact' ||
    value === 'public-contribution-record' ||
    value === 'public-authorship-record'
  );
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isEvidenceSource(value: unknown): value is FitEvidenceSource {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    (value.url === undefined || isHttpsUrl(value.url)) &&
    isProvenance(value.provenance)
  );
}

function isEvidence(value: unknown): value is FitEvidence {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.organization === 'string' &&
    typeof value.claim === 'string' &&
    isStringArray(value.caveats) &&
    Array.isArray(value.sources) &&
    value.sources.every(isEvidenceSource)
  );
}

function isRequirement(value: unknown): value is RoleRequirement {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.sourceExcerpt === 'string' &&
    (value.priority === 'required' ||
      value.priority === 'preferred' ||
      value.priority === 'inferred')
  );
}

function isFitBrief(value: unknown): value is FitBrief {
  if (!isRecord(value) || !isRecord(value.role) || !isRecord(value.meta)) {
    return false;
  }

  const requirements = value.role.requirements;
  const matches = value.matches;
  const unknowns = value.unknowns;
  const interviewQuestions = value.interviewQuestions;

  return (
    (value.role.title === null || typeof value.role.title === 'string') &&
    (value.role.company === null || typeof value.role.company === 'string') &&
    value.role.sourceKind === 'text' &&
    Array.isArray(requirements) &&
    requirements.length >= 2 &&
    requirements.length <= 6 &&
    requirements.every(isRequirement) &&
    typeof value.summary === 'string' &&
    Array.isArray(matches) &&
    matches.length <= 6 &&
    matches.every(
      (match) =>
        isRecord(match) &&
        typeof match.requirementId === 'string' &&
        (match.relationship === 'direct' ||
          match.relationship === 'adjacent') &&
        typeof match.rationale === 'string' &&
        Array.isArray(match.evidence) &&
        match.evidence.length > 0 &&
        match.evidence.every(isEvidence)
    ) &&
    Array.isArray(unknowns) &&
    unknowns.length <= 6 &&
    unknowns.every(
      (unknown) =>
        isRecord(unknown) &&
        typeof unknown.requirementId === 'string' &&
        unknown.reason === 'no-public-evidence' &&
        typeof unknown.explanation === 'string'
    ) &&
    Array.isArray(interviewQuestions) &&
    interviewQuestions.length === 3 &&
    interviewQuestions.every(
      (question) =>
        isRecord(question) &&
        typeof question.question === 'string' &&
        isStringArray(question.resolvesRequirementIds) &&
        isStringArray(question.testsClaimIds)
    ) &&
    typeof value.meta.requestId === 'string' &&
    typeof value.meta.evidenceVersion === 'string' &&
    typeof value.meta.generatedAt === 'string'
  );
}

function getApiError(payload: unknown): FitApiError | null {
  if (
    !isRecord(payload) ||
    !isRecord(payload.error) ||
    typeof payload.error.code !== 'string' ||
    typeof payload.error.message !== 'string'
  ) {
    return null;
  }

  return payload as FitApiError;
}

function formatGeneratedAt(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return DATE_FORMATTER.format(date);
}

function formatEvidenceReviewedAt(version: string): string | null {
  const datePart = version.match(/^(\d{4}-\d{2}-\d{2})\./)?.[1];
  return datePart ? formatGeneratedAt(`${datePart}T12:00:00Z`) : null;
}

function SourceReference({ source }: { source: FitEvidenceSource }) {
  const content = (
    <>
      <span className="role-fit__provenance">
        {PROVENANCE_LABELS[source.provenance]}
      </span>
      <span>{source.label}</span>
      {source.url ? <ArrowUpRight aria-hidden="true" /> : null}
    </>
  );

  if (!source.url) {
    return <span className="role-fit__source">{content}</span>;
  }

  return (
    <a
      className="role-fit__source"
      href={source.url}
      target="_blank"
      rel="noreferrer"
    >
      {content}
    </a>
  );
}

function EvidenceRecord({ evidence }: { evidence: FitEvidence }) {
  return (
    <div className="role-fit__evidence-record">
      <div className="role-fit__evidence-heading">
        <h5>{evidence.title}</h5>
        <span>{evidence.organization}</span>
      </div>
      <p>{evidence.claim}</p>

      <div className="role-fit__sources" aria-label="Evidence sources">
        {evidence.sources.map((source) => (
          <SourceReference
            key={`${evidence.id}-${source.id}`}
            source={source}
          />
        ))}
      </div>

      {evidence.caveats.length > 0 ? (
        <ul className="role-fit__caveats" aria-label="Evidence context">
          {evidence.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FitBriefView({ brief }: { brief: FitBrief }) {
  const roleName = [brief.role.title, brief.role.company]
    .filter(Boolean)
    .join(' · ');
  const requirementById = new Map(
    brief.role.requirements.map((requirement) => [requirement.id, requirement])
  );
  const generatedAt = formatGeneratedAt(brief.meta.generatedAt);
  const evidenceReviewedAt = formatEvidenceReviewedAt(
    brief.meta.evidenceVersion
  );

  return (
    <article className="role-fit__desk" aria-labelledby="fit-brief-title">
      <header className="role-fit__desk-header">
        <div>
          <p className="role-fit__desk-label">Role interpretation</p>
          <h3 id="fit-brief-title">{roleName || 'Pasted role'}</h3>
        </div>
        <p>
          This uses only what you pasted. Any inferred priorities are labeled.
        </p>
      </header>

      <ul className="role-fit__requirements" aria-label="Role priorities">
        {brief.role.requirements.slice(0, 6).map((requirement) => (
          <li key={requirement.id}>
            <span>{PRIORITY_LABELS[requirement.priority]}</span>
            {requirement.label}
          </li>
        ))}
      </ul>

      <section
        className="role-fit__summary"
        aria-labelledby="fit-summary-title"
      >
        <p className="role-fit__desk-label" id="fit-summary-title">
          Bottom line
        </p>
        <p>{brief.summary}</p>
      </section>

      <section
        className="role-fit__desk-section"
        aria-labelledby="fit-overlaps-title"
      >
        <header className="role-fit__section-heading">
          <p className="role-fit__desk-label">Matches</p>
          <h4 id="fit-overlaps-title">Where Ahmed’s work lines up</h4>
        </header>

        <div className="role-fit__matches">
          {brief.matches.length > 0 ? (
            brief.matches.map((match) => {
              const requirement = requirementById.get(match.requirementId);

              return (
                <article
                  className="role-fit__match"
                  key={`${match.requirementId}-${match.relationship}`}
                >
                  <div className="role-fit__match-role">
                    <span className="role-fit__relationship">
                      {match.relationship === 'direct'
                        ? 'Mapped overlap'
                        : 'Related work'}
                    </span>
                    <h5>{requirement?.label ?? 'Role requirement'}</h5>
                    {requirement?.sourceExcerpt &&
                    requirement.sourceExcerpt !== requirement.label ? (
                      <p>“{requirement.sourceExcerpt}”</p>
                    ) : null}
                  </div>

                  <div className="role-fit__arrow" aria-hidden="true">
                    <ArrowRight />
                  </div>

                  <div className="role-fit__match-evidence">
                    <p className="role-fit__rationale">{match.rationale}</p>
                    {match.evidence.map((evidence) => (
                      <EvidenceRecord key={evidence.id} evidence={evidence} />
                    ))}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="role-fit__empty-result">
              Nothing on this site clearly matches the role. Ahmed may still
              have relevant experience that isn’t public.
            </p>
          )}
        </div>
      </section>

      <section
        className="role-fit__desk-section"
        aria-labelledby="fit-unknowns-title"
      >
        <header className="role-fit__section-heading">
          <p className="role-fit__desk-label">Open questions</p>
          <h4 id="fit-unknowns-title">What this site can’t answer</h4>
        </header>

        <div className="role-fit__unknowns">
          {brief.unknowns.length > 0 ? (
            brief.unknowns.map((unknown) => {
              const requirement = requirementById.get(unknown.requirementId);

              return (
                <article key={`${unknown.requirementId}-${unknown.reason}`}>
                  <div>
                    <span>No public evidence here</span>
                    <h5>{requirement?.label ?? 'Role requirement'}</h5>
                  </div>
                  <p>{unknown.explanation}</p>
                </article>
              );
            })
          ) : (
            <p className="role-fit__empty-result">
              This comparison did not leave any listed requirement without
              related public work.
            </p>
          )}
        </div>
      </section>

      <section
        className="role-fit__desk-section"
        aria-labelledby="fit-questions-title"
      >
        <header className="role-fit__section-heading">
          <p className="role-fit__desk-label">Interview guide</p>
          <h4 id="fit-questions-title">Questions worth asking Ahmed</h4>
        </header>

        <ol className="role-fit__questions">
          {brief.interviewQuestions.map((question, index) => (
            <li key={question.question}>
              <span aria-hidden="true">Q{index + 1}</span>
              <p>{question.question}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="role-fit__disclosure">
        <div>
          <p className="role-fit__desk-label">About this brief</p>
          <p>
            This AI-assisted comparison uses claims and links Ahmed has
            published. Project links show that the work exists; some role and
            ownership details are Ahmed’s own account. Use the questions above
            to verify them.
          </p>
          <p className="role-fit__meta">
            {evidenceReviewedAt
              ? `Sources reviewed ${evidenceReviewedAt}`
              : 'Published sources'}
            {generatedAt ? ` · Compared ${generatedAt}` : null}
          </p>
        </div>
        <div className="role-fit__brief-links">
          <Link to="/resume">
            View résumé <ArrowUpRight aria-hidden="true" />
          </Link>
          <a href="#contact">
            Contact Ahmed <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </footer>
    </article>
  );
}

export function RoleFit() {
  const [roleText, setRoleText] = useState('');
  const [roleFiles, setRoleFiles] = useState<RoleFileState[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>({
    status: 'idle',
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileReadSequenceRef = useRef(0);
  const fileReadersRef = useRef(new Map<string, AbortController>());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const readyFiles = useMemo(
    () =>
      roleFiles.reduce<Array<{ name: string; text: string }>>(
        (files, roleFile) => {
          if (roleFile.status === 'ready') {
            files.push({ name: roleFile.file.name, text: roleFile.text });
          }

          return files;
        },
        []
      ),
    [roleFiles]
  );
  const roleInput = useMemo(
    () => buildRoleInput(roleText, readyFiles),
    [readyFiles, roleText]
  );
  const roleInputLength = roleInput.trim().length;
  const filesAreReading = roleFiles.some(
    (roleFile) => roleFile.status === 'reading'
  );

  useEffect(() => {
    const fileReaders = fileReadersRef.current;

    return () => {
      abortControllerRef.current?.abort();
      fileReaders.forEach((controller) => controller.abort());
      fileReaders.clear();
    };
  }, []);

  useEffect(() => {
    if (requestState.status !== 'success') {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      resultRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [requestState.status]);

  const focusTextarea = () => {
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const clearTransientState = () => {
    setFieldError(null);
    setNotice(null);

    if (requestState.status === 'error') {
      setRequestState({ status: 'idle' });
    }
  };

  const addRoleFiles = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) {
      return;
    }

    clearTransientState();

    const existingIds = new Set(
      roleFiles.map((roleFile) => roleFile.fingerprint)
    );
    const incomingIds = new Set<string>();
    const uniqueFiles = incomingFiles.filter((file) => {
      const id = getRoleFileKey(file);
      if (existingIds.has(id) || incomingIds.has(id)) return false;

      incomingIds.add(id);
      return true;
    });
    const remainingSlots = Math.max(0, MAX_FILES - roleFiles.length);
    const filesToRead = uniqueFiles.slice(0, remainingSlots);

    if (filesToRead.length === 0) {
      setFieldError(
        uniqueFiles.length === 0
          ? 'That file is already in the role workspace.'
          : `You can add up to ${MAX_FILES} files. Remove one before adding another.`
      );
      return;
    }

    if (uniqueFiles.length > remainingSlots) {
      setFieldError(
        `Added ${filesToRead.length} file${filesToRead.length === 1 ? '' : 's'}. You can use up to ${MAX_FILES} at a time.`
      );
    }

    const pendingFiles: RoleFileState[] = filesToRead.map((file) => {
      const fingerprint = getRoleFileKey(file);
      fileReadSequenceRef.current += 1;

      return {
        file,
        id: `role-file-${fileReadSequenceRef.current}`,
        fingerprint,
        status: 'reading',
        text: '',
      };
    });

    setRoleFiles((current) => [...current, ...pendingFiles]);

    pendingFiles.forEach((pendingFile) => {
      const controller = new AbortController();
      fileReadersRef.current.set(pendingFile.id, controller);

      void extractRoleFile(pendingFile.file, controller.signal)
        .then((text) => {
          setRoleFiles((current) =>
            current.map((roleFile) =>
              roleFile.id === pendingFile.id
                ? { ...roleFile, status: 'ready', text }
                : roleFile
            )
          );
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error
              ? error.message
              : 'This file could not be read. Try a different copy.';

          setRoleFiles((current) =>
            current.map((roleFile) =>
              roleFile.id === pendingFile.id
                ? {
                    ...roleFile,
                    status: 'error',
                    text: '',
                    error: message,
                  }
                : roleFile
            )
          );
        })
        .finally(() => {
          fileReadersRef.current.delete(pendingFile.id);
        });
    });
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addRoleFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!isLoading && roleFiles.length < MAX_FILES) {
      event.dataTransfer.dropEffect = 'copy';
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);

    if (!isLoading) {
      addRoleFiles(Array.from(event.dataTransfer.files));
    }
  };

  const handleRemoveFile = (id: string) => {
    fileReadersRef.current.get(id)?.abort();
    fileReadersRef.current.delete(id);
    setRoleFiles((current) => current.filter((roleFile) => roleFile.id !== id));
    setFieldError(null);
    setNotice('File removed.');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (requestState.status === 'loading' || abortControllerRef.current) {
      return;
    }

    const text = roleInput.trim();

    if (text.length < MIN_ROLE_LENGTH) {
      const message = `Add the role’s responsibilities and requirements (${MIN_ROLE_LENGTH} characters minimum).`;
      setFieldError(message);
      setRequestState({ status: 'idle' });
      setNotice(null);
      textareaRef.current?.focus();
      return;
    }

    if (text.length > MAX_ROLE_LENGTH) {
      const message = `Shorten the role description to ${MAX_ROLE_LENGTH.toLocaleString()} characters or fewer.`;
      setFieldError(message);
      setRequestState({ status: 'idle' });
      setNotice(null);
      textareaRef.current?.focus();
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setFieldError(null);
    setNotice(null);
    setRequestState({ status: 'loading' });

    try {
      const response = await fetch('/api/fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { type: 'text', text } }),
        signal: controller.signal,
      });

      if (abortControllerRef.current !== controller) {
        return;
      }

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        const apiError = getApiError(errorPayload);
        const message =
          response.status === 429
            ? 'The demo is busy right now. Try again in about 10 minutes, or read Ahmed’s résumé.'
            : apiError
              ? (API_ERROR_MESSAGES[apiError.error.code] ??
                apiError.error.message)
              : 'The comparison did not finish. Try again or read Ahmed’s résumé.';

        setRequestState({ status: 'error', message });
        return;
      }

      const payload: unknown = await response.json().catch(() => null);

      if (!isFitBrief(payload)) {
        setRequestState({
          status: 'error',
          message:
            'The comparison returned an incomplete brief. Try again or read Ahmed’s résumé.',
        });
        return;
      }

      setRequestState({ status: 'success', brief: payload });
    } catch (error) {
      if (abortControllerRef.current !== controller) {
        return;
      }

      if (controller.signal.aborted) {
        setRequestState({ status: 'idle' });
        setNotice('Comparison cancelled. Your role description is still here.');
        return;
      }

      setRequestState({
        status: 'error',
        message:
          error instanceof TypeError
            ? 'The comparison could not reach the service. Check your connection and try again.'
            : 'The comparison did not finish. Try again or read Ahmed’s résumé.',
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setRequestState({ status: 'idle' });
    setNotice('Comparison cancelled. Your role description is still here.');
    focusTextarea();
  };

  const handleEdit = () => {
    setRequestState({ status: 'idle' });
    setFieldError(null);
    setNotice('Role description ready to edit.');
    focusTextarea();
  };

  const handleReset = () => {
    fileReadersRef.current.forEach((controller) => controller.abort());
    fileReadersRef.current.clear();
    setRoleText('');
    setRoleFiles([]);
    setIsDragActive(false);
    setRequestState({ status: 'idle' });
    setFieldError(null);
    setNotice('Ready for another role description.');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    focusTextarea();
  };

  const handleRoleTextChange = (value: string) => {
    setRoleText(value);
    clearTransientState();
  };

  const isLoading = requestState.status === 'loading';
  const showForm = requestState.status !== 'success';

  return (
    <section
      className="role-fit"
      id="role-fit"
      aria-labelledby="role-fit-title"
      aria-busy={isLoading}
    >
      <div className="role-fit__inner">
        <header className="role-fit__intro">
          <p className="eyebrow">ROLE / EVIDENCE</p>
          <div>
            <h2 id="role-fit-title">How does Ahmed fit this role?</h2>
            <p>
              Add a job description as files, pasted text, or both. You’ll see
              where Ahmed’s public work lines up, what this site can’t answer,
              and three questions to test the fit.
            </p>
          </div>
        </header>

        {showForm ? (
          <div className="role-fit__workbench">
            <form className="role-fit__form" onSubmit={handleSubmit} noValidate>
              <div className="role-fit__form-topline">
                <span>Role workspace</span>
                <span
                  className={
                    roleInputLength > MAX_ROLE_LENGTH
                      ? 'role-fit__count role-fit__count--over'
                      : 'role-fit__count'
                  }
                  aria-label={`${roleInputLength.toLocaleString()} of ${MAX_ROLE_LENGTH.toLocaleString()} combined characters`}
                >
                  {roleInputLength.toLocaleString()} /{' '}
                  {MAX_ROLE_LENGTH.toLocaleString()}
                </span>
              </div>

              <div className="role-fit__input-workspace">
                <div className="role-fit__file-column">
                  <div
                    className={`role-fit__dropzone${isDragActive ? ' role-fit__dropzone--active' : ''}`}
                    role="button"
                    tabIndex={isLoading ? -1 : 0}
                    aria-label="Choose or drop role description files"
                    aria-disabled={
                      isLoading || roleFiles.length >= MAX_FILES
                        ? 'true'
                        : undefined
                    }
                    aria-describedby="role-fit-file-help"
                    onClick={() => {
                      if (!isLoading && roleFiles.length < MAX_FILES) {
                        fileInputRef.current?.click();
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        (event.key === 'Enter' || event.key === ' ') &&
                        !isLoading &&
                        roleFiles.length < MAX_FILES
                      ) {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragEnter={handleDragOver}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <FileUp aria-hidden="true" />
                    <div>
                      <h3>
                        {roleFiles.length >= MAX_FILES
                          ? 'File slots full'
                          : isDragActive
                            ? 'Drop to add files'
                            : 'Drop job files here'}
                      </h3>
                      <p id="role-fit-file-help">
                        PDF, DOCX, TXT, or Markdown · up to {MAX_FILES} files ·
                        {MAX_FILE_SIZE_LABEL} each
                      </p>
                    </div>
                    <span className="role-fit__choose-files">
                      {roleFiles.length >= MAX_FILES
                        ? `${MAX_FILES} files added`
                        : 'Choose files'}
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    className="role-fit__file-input"
                    type="file"
                    aria-label="Choose job description files"
                    accept={ACCEPTED_FILE_TYPES}
                    multiple
                    onChange={handleFileInputChange}
                    disabled={isLoading || roleFiles.length >= MAX_FILES}
                    tabIndex={-1}
                  />

                  {roleFiles.length > 0 ? (
                    <ul
                      className="role-fit__file-list"
                      aria-label="Files added to the role description"
                      aria-live="polite"
                    >
                      {roleFiles.map((roleFile) => (
                        <li
                          key={roleFile.id}
                          className={`role-fit__file-row role-fit__file-row--${roleFile.status}`}
                        >
                          <span className="role-fit__file-status">
                            {roleFile.status === 'reading' ? (
                              <LoaderCircle aria-hidden="true" />
                            ) : roleFile.status === 'ready' ? (
                              <Check aria-hidden="true" />
                            ) : (
                              <span aria-hidden="true">!</span>
                            )}
                          </span>
                          <span className="role-fit__file-copy">
                            <strong>{roleFile.file.name}</strong>
                            <small>
                              {roleFile.status === 'reading'
                                ? 'Reading locally…'
                                : roleFile.status === 'ready'
                                  ? `${formatFileSize(roleFile.file.size)} · ${roleFile.text.trim().length.toLocaleString()} characters ready`
                                  : roleFile.error}
                            </small>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(roleFile.id)}
                            disabled={isLoading}
                            aria-label={`Remove ${roleFile.file.name}`}
                          >
                            <X aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="role-fit__text-column">
                  <label htmlFor="role-fit-input">Paste or add context</label>
                  <p>
                    Paste the full role here, or add anything the files missed.
                  </p>
                  <textarea
                    ref={textareaRef}
                    id="role-fit-input"
                    name="role-description"
                    value={roleText}
                    onChange={(event) =>
                      handleRoleTextChange(event.target.value)
                    }
                    maxLength={MAX_ROLE_LENGTH}
                    placeholder="Responsibilities, requirements, team context…"
                    aria-describedby={`role-fit-input-help${fieldError ? ' role-fit-input-error' : ''}`}
                    aria-invalid={fieldError ? 'true' : undefined}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="role-fit__input-meta">
                <p id="role-fit-input-help">
                  {MIN_ROLE_LENGTH.toLocaleString()}–
                  {MAX_ROLE_LENGTH.toLocaleString()} combined characters ·
                  Public role descriptions only
                </p>
                {fieldError ? (
                  <p id="role-fit-input-error" role="alert">
                    {fieldError}
                  </p>
                ) : null}
              </div>

              <div className="role-fit__form-footer">
                <p>
                  Files are read in your browser and never uploaded. Only the
                  extracted text is sent to Anthropic for this comparison;
                  Ahmed’s site does not save it.
                </p>
                <button
                  className="role-fit__submit"
                  type="submit"
                  disabled={
                    isLoading || filesAreReading || roleInputLength === 0
                  }
                >
                  {filesAreReading
                    ? 'Reading files…'
                    : 'Compare with Ahmed’s work'}
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </form>

            {requestState.status === 'loading' ? (
              <div
                className="role-fit__loading"
                role="status"
                aria-live="polite"
              >
                <div>
                  <p className="role-fit__desk-label">Building the brief</p>
                  <h3>Checking the role against Ahmed’s work.</h3>
                </div>
                <button type="button" onClick={handleCancel}>
                  Cancel comparison
                </button>
              </div>
            ) : null}

            {requestState.status === 'error' ? (
              <div className="role-fit__error" role="alert">
                <div>
                  <p className="role-fit__desk-label">Brief not completed</p>
                  <p>{requestState.message}</p>
                </div>
                <Link to="/resume">Read Ahmed’s résumé</Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {notice ? (
          <p className="role-fit__notice" role="status" aria-live="polite">
            {notice}
          </p>
        ) : null}

        {requestState.status === 'success' ? (
          <div ref={resultRef} className="role-fit__result" tabIndex={-1}>
            <div className="role-fit__result-actions">
              <div>
                <button type="button" onClick={handleEdit}>
                  Edit role
                </button>
                <button type="button" onClick={handleReset}>
                  Try another role
                </button>
              </div>
            </div>
            <FitBriefView brief={requestState.brief} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
