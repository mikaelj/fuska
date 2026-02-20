/**
 * Shared initiative identification and lookup utilities.
 *
 * An initiative is a root feature node (`kind === 'feature'`, `parent_id === null`)
 * that has a child node with `name === 'state'` and `kind === 'config'` where
 * `child.parent_id === node.id`. Domain nodes from codebase mapping never have
 * this structure, so this check is definitive.
 */

export interface NodeData {
  id: string;
  name: string;
  kind: string;
  summary: string;
  parent_id: string | null;
  children?: string[];
}

export interface ConfigData {
  depth?: string;
  autonomous_mode?: boolean;
  current_initiative?: string | null;
  [key: string]: any;
}

export interface InitiativeInfo {
  node: NodeData;
  slug: string;
  name: string;
  isCurrent: boolean;
}

/**
 * Find all real initiatives in the database.
 * Filters out domain nodes and other non-initiative feature nodes by
 * requiring the presence of a 'state' child (kind=config).
 */
export function findAllInitiatives(db: any): InitiativeInfo[] {
  const nodes: NodeData[] = db.getAllActiveNodes();
  const currentSlug = getCurrentInitiativeSlug(db);

  const rootFeatures = nodes.filter(
    (n) => n.kind === 'feature' && n.parent_id === null
  );

  const initiatives: InitiativeInfo[] = [];

  for (const root of rootFeatures) {
    const hasStateChild = nodes.some(
      (n) =>
        n.name === 'state' &&
        n.kind === 'config' &&
        n.parent_id === root.id
    );

    if (!hasStateChild) continue;

    initiatives.push({
      node: root,
      slug: root.name,
      name: extractInitiativeName(root),
      isCurrent: root.name === currentSlug,
    });
  }

  return initiatives;
}

/**
 * Find a single initiative by its slug.
 */
export function findInitiativeBySlug(
  db: any,
  slug: string
): InitiativeInfo | null {
  const all = findAllInitiatives(db);
  return all.find((i) => i.slug === slug) || null;
}

/**
 * Get the current initiative slug from the global config concept.
 */
export function getCurrentInitiativeSlug(db: any): string | null {
  const config = getConfig(db);
  return config?.current_initiative || null;
}

/**
 * Get the global config concept data (parent_id === null, name === 'config').
 */
export function getConfig(db: any): ConfigData | null {
  const nodes: NodeData[] = db.getAllActiveNodes();
  const configNode = nodes.find(
    (n) => n.name === 'config' && n.kind === 'config' && !n.parent_id
  );

  if (!configNode) return null;

  try {
    return JSON.parse(configNode.summary);
  } catch {
    return null;
  }
}

/**
 * Get the raw global config node (for updating).
 */
export function getConfigNode(db: any): NodeData | null {
  const nodes: NodeData[] = db.getAllActiveNodes();
  return (
    nodes.find(
      (n) => n.name === 'config' && n.kind === 'config' && !n.parent_id
    ) || null
  );
}

/**
 * Set (or create) the current_initiative pointer in the global config.
 */
export async function setCurrentInitiative(
  db: any,
  slug: string | null
): Promise<void> {
  const { createConcept, updateConcept } = await import(
    'megamemory/dist/tools.js'
  );

  const nodes: NodeData[] = db.getAllActiveNodes();
  const configNode = nodes.find(
    (n) => n.name === 'config' && n.kind === 'config' && !n.parent_id
  );

  if (!configNode) {
    await createConcept(db, {
      name: 'config',
      kind: 'config',
      summary: JSON.stringify({
        depth: 'balanced',
        autonomous_mode: false,
        current_initiative: slug,
      }),
      parent_id: undefined,
      edges: [],
    });
  } else {
    let configData: any = {};
    try {
      configData = JSON.parse(configNode.summary);
    } catch {}

    configData.current_initiative = slug;

    await updateConcept(db, {
      id: configNode.id,
      changes: { summary: JSON.stringify(configData) },
    });
  }
}

/**
 * Extract the display name from an initiative node's summary.
 */
export function extractInitiativeName(node: NodeData): string {
  try {
    const summary = JSON.parse(node.summary);
    return summary.name || summary.initiative_name || node.name;
  } catch {
    return node.name;
  }
}

export interface InitiativeIntegrityStatus {
  hasConfig: boolean;
  currentInitiativeSlug: string | null;
  foundInitiatives: InitiativeInfo[];
  isValid: boolean;
  issue: 'no_config' | 'no_current' | 'slug_mismatch' | 'no_initiatives' | null;
}

export function checkInitiativeIntegrity(db: any): InitiativeIntegrityStatus {
  const config = getConfig(db);
  const foundInitiatives = findAllInitiatives(db);

  if (!config) {
    return {
      hasConfig: false,
      currentInitiativeSlug: null,
      foundInitiatives,
      isValid: false,
      issue: 'no_config'
    };
  }

  const currentSlug = config.current_initiative || null;

  if (foundInitiatives.length === 0) {
    return {
      hasConfig: true,
      currentInitiativeSlug: currentSlug,
      foundInitiatives: [],
      isValid: false,
      issue: 'no_initiatives'
    };
  }

  if (!currentSlug) {
    return {
      hasConfig: true,
      currentInitiativeSlug: null,
      foundInitiatives,
      isValid: false,
      issue: 'no_current'
    };
  }

  const matches = foundInitiatives.some(i => i.slug === currentSlug);

  if (!matches) {
    return {
      hasConfig: true,
      currentInitiativeSlug: currentSlug,
      foundInitiatives,
      isValid: false,
      issue: 'slug_mismatch'
    };
  }

  return {
    hasConfig: true,
    currentInitiativeSlug: currentSlug,
    foundInitiatives,
    isValid: true,
    issue: null
  };
}
