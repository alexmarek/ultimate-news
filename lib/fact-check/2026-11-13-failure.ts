const jobMessages = {
  article_access: { title: 'Could not open the article', next: 'Open the link in your browser. If it opens there, try again or use a link from another publisher.', retry: true },
  article_blocked: { title: 'The article site refused access', next: 'The site returned HTTP 403 to the fact checker. Try a publicly readable copy of the article or another outlet’s coverage.' },
  article_paywall: { title: 'Article appears to require a subscription or sign-in', next: 'Use a publicly readable article covering the same claim.' },
  article_timeout: { title: 'The publisher took too long to respond', next: 'Try the check again in a few minutes, or use a link from another publisher.', retry: true },
  article_text: { title: 'Could not extract usable article text', next: 'Use a standard text article from the publisher. Video pages, short excerpts and very long pages may be outside the extraction limits.' },
  no_claims: { title: 'No checkable claims found', next: 'Try an article that makes specific factual claims.' },
  budget: { title: 'Check reached its spending or search limit', next: 'Try fewer claims per check. Review the configured spending and search limits before rechecking.' },
  provider_access: { title: 'OpenRouter refused access', next: 'Check that the API key is active and allowed to use the configured model, then recheck the article.' },
  provider_credits: { title: 'OpenRouter reported a payment or credit issue', next: 'Check your OpenRouter balance and key spending limit, then recheck the article.' },
  provider_timeout: { title: 'OpenRouter took too long to respond', next: 'Wait a few minutes before trying again.', retry: true },
  provider_busy: { title: 'OpenRouter or the model provider was unavailable', next: 'Wait a few minutes before trying again.', retry: true },
  provider_request: { title: 'OpenRouter rejected the request', next: 'Check that the configured model and provider support the requested search or response format.' },
  provider_truncated: { title: 'The model ran out of room to answer', next: 'The model reached its output limit. Use a model that can complete the check within the configured limits.' },
  provider_output: { title: 'The model returned an unreadable answer', next: 'Retry once. If it repeats, try a model that reliably returns structured responses.', retry: true },
  evidence_validation: { title: 'The model’s evidence could not be validated', next: 'The check rejected the model’s citations or verdict. Retry once. If it repeats, try a different model.', retry: true },
  evidence_claims: { title: 'The assessment didn’t match the claims', next: 'The model omitted, duplicated, or changed a claim reference. Try the check again.', retry: true },
  evidence_reference: { title: 'The assessment cited an invalid source', next: 'A citation did not match the sources retrieved for the claim. Try the check again.', retry: true },
  evidence_passage: { title: 'The assessment cited an unknown passage', next: 'The model selected a passage that was not among the retrieved sources. Try the check again.', retry: true },
  evidence_wrong_claim: { title: 'The assessment cited a passage for another claim', next: 'The model selected evidence belonging to a different claim. Try the check again.', retry: true },
  evidence_duplicate_source: { title: 'The assessment cited a source more than once', next: 'The model selected multiple passages or conflicting relationships for one source. Try the check again.', retry: true },
  evidence_quote: { title: 'The assessment included an invalid quotation', next: 'A quotation was missing, repeated, or could not be verified against the source text. Try the check again.', retry: true },
  evidence_score: { title: 'The score did not match the verdict', next: 'The model returned a score outside the range for its verdict. Try the check again.', retry: true },
  evidence_required: { title: 'A scored claim had no citation', next: 'The model gave a score without citing a retrieved source. Try the check again.', retry: true },
  evidence_relationship: { title: 'A citation conflicted with the verdict', next: 'The model marked a source as both supporting and contradicting a claim. That requires a Mostly True, Mixed, or Mostly False verdict. Try the check again.', retry: true },
  evidence_central: { title: 'The overall verdict lacked evidence', next: 'The model scored the article even though none of its main claims could be verified. Try the check again.', retry: true },
  configuration: { title: 'Fact-check settings need attention', next: 'Check the OpenRouter key, selected model, and research limits. Start a new check after correcting the settings.' },
  identification_failed: { title: 'Could not identify the claims', next: 'Try a text article with clearly stated factual claims. If this repeats across articles, check the model settings.', retry: true },
  research_failed: { title: 'Evidence research failed', next: 'The research step stopped before it could return a result. Retry once. If it repeats, check the model and search settings.', retry: true },
  evaluation_failed: { title: 'Could not evaluate the evidence', next: 'Try again once. If it fails again, check the configured model or try a simpler article.', retry: true },
  review_failed: { title: 'Could not prepare the report for review', next: 'Try again once. If it repeats, use a different article and keep this report for troubleshooting.', retry: true },
  processing_failed: { title: 'The check failed before a report was ready', next: 'This run did not record a detailed reason. Try again to get a more specific diagnosis if the problem repeats.', retry: true },
} satisfies Record<string, { title: string; next: string; retry?: boolean }>;

const submissionMessages = {
  invalid: 'Enter a complete public article URL starting with https:// or http://.',
  invalid_text: 'Enter text to check, up to 19,000 characters.',
  invalid_image: 'Choose a PNG, JPEG or WebP image up to 3 MB.',
  image_text: 'Could not read text from the image. Try a clearer image with visible text.',
  unreachable: 'Could not reach the article’s website. Check that the link opens in your browser, then try again.',
  busy: 'Another fact check is running. Open its report below to see its status, then try this link again when it finishes.',
  stalled: 'An earlier attempt to start this check needs manual recovery. Keep the queued report for troubleshooting.',
  unavailable: 'Fact checks are unavailable. Check the OpenRouter key, selected model, and research limits.',
  failed: 'Could not start the fact check. Try again in a moment. If it repeats, check the app’s database and workflow configuration.',
};

export type JobFailure = keyof typeof jobMessages;
export type SubmissionFailure = keyof typeof submissionMessages;
export type FailureCode = JobFailure | SubmissionFailure;

export class FactCheckFailure extends Error {
  constructor(readonly code: FailureCode, message: string = code) {
    super(message);
  }
}

export function submissionFailureCode(error: unknown): SubmissionFailure {
  return error instanceof FactCheckFailure && Object.prototype.hasOwnProperty.call(submissionMessages, error.code)
    ? error.code as SubmissionFailure : 'failed';
}

export function jobFailureMessage(code: string | null | undefined): { title: string; next: string; retry?: boolean } {
  return code && Object.prototype.hasOwnProperty.call(jobMessages, code) ? jobMessages[code as JobFailure] : jobMessages.processing_failed;
}

export function submissionFailureMessage(code: string | undefined): string | undefined {
  return code && Object.prototype.hasOwnProperty.call(submissionMessages, code) ? submissionMessages[code as SubmissionFailure] : undefined;
}

// Workflow step errors cross a serialization boundary. Only known codes may cross it.
export function jobFailureFromStep(error: unknown, fallback: JobFailure): JobFailure {
  // Rehydrated workflow errors can come from a different JavaScript realm.
  for (let depth = 0; depth < 3 && typeof error === 'object' && error !== null; depth++) {
    const { message, cause } = error as { message?: unknown; cause?: unknown };
    if (typeof message === 'string' && Object.prototype.hasOwnProperty.call(jobMessages, message)) return message as JobFailure;
    error = cause;
  }
  return fallback;
}

export function openRouterFailure(status: number): FactCheckFailure {
  const message = `OpenRouter request failed (${status})`;
  if (status === 401 || status === 403) return new FactCheckFailure('provider_access', message);
  if (status === 402) return new FactCheckFailure('provider_credits', message);
  if (status === 408 || status === 504) return new FactCheckFailure('provider_timeout', message);
  if (status === 429 || status >= 500) return new FactCheckFailure('provider_busy', message);
  return new FactCheckFailure(status >= 400 && status < 500 ? 'provider_request' : 'provider_output', message);
}

export async function requestOpenRouter(request: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    const response = await request(url, init);
    if (!response.ok) throw openRouterFailure(response.status);
    return response;
  } catch (error) {
    if (init.signal?.aborted || (error instanceof Error && error.name === 'TimeoutError')) {
      throw new FactCheckFailure('provider_timeout');
    }
    if (error instanceof FactCheckFailure) throw error;
    if (error instanceof TypeError) throw new FactCheckFailure('provider_busy');
    throw error;
  }
}
