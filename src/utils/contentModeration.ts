import LinkifyIt from 'linkify-it';

const linkify = new LinkifyIt();

const TOXICITY_THRESHOLD = 0.84;
const TOXICITY_LABELS = ['identity_attack', 'severe_toxicity', 'threat'];

let toxicityPromise: Promise<unknown> | null = null;

async function getToxicityClassifier(): Promise<{
  classify: (inputs: string[]) => Promise<{ label: string; results: { match: boolean }[] }[]>;
}> {
  if (!toxicityPromise) {
    toxicityPromise = (async () => {
      
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const toxicity = await import('@tensorflow-models/toxicity');
      return toxicity.load(TOXICITY_THRESHOLD, [...TOXICITY_LABELS]);
    })();
  }
  return toxicityPromise as Promise<{
    classify: (inputs: string[]) => Promise<{ label: string; results: { match: boolean }[] }[]>;
  }>;
}

export async function classifySevereToxicity(raw: string): Promise<{
  flagged: boolean;
  labels: string[];
}> {
  const text = raw.trim();
  if (!text) return { flagged: false, labels: [] };
  try {
    const model = await getToxicityClassifier();
    const preds = await model.classify([text.slice(0, 2048)]);
    const labels: string[] = [];
    for (const p of preds) {
      const hit = p.results[0]?.match;
      if (hit) labels.push(p.label);
    }
    return { flagged: labels.length > 0, labels };
  } catch {
    
    return { flagged: false, labels: [] };
  }
}

export function textContainsUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (linkify.test(t)) return true;
  return /(?:https?:\/\/|www\.|\b[a-z0-9][a-z0-9.-]{0,61}\.[a-z]{2,24}\b)/i.test(
    t,
  );
}

export const CONTENT_POLICY_MESSAGES = {
  link: 'Links and URLs are not allowed.',
  toxic: 'This content is not allowed.',
} as const;

export function quickTextPolicyFailReason(raw: string): string | null {
  if (textContainsUrl(raw)) return CONTENT_POLICY_MESSAGES.link;
  return null;
}

export async function moderationFailReasonForUserText(
  raw: string,
): Promise<string | null> {
  const link = quickTextPolicyFailReason(raw);
  if (link) return link;
  const { flagged } = await classifySevereToxicity(raw);
  if (flagged) return CONTENT_POLICY_MESSAGES.toxic;
  return null;
}

export async function evaluateCommentForClientHold(body: string): Promise<{
  needsHold: boolean;
  detail: string;
}> {
  const link = textContainsUrl(body);
  const { flagged, labels } = await classifySevereToxicity(body);
  if (!link && !flagged) return { needsHold: false, detail: '' };
  const parts = [...(link ? ['url'] : []), ...labels];
  return { needsHold: true, detail: parts.join(',') };
}
