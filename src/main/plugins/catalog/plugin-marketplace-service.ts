import {
  OFFICIAL_MARKETPLACE_GIT_SOURCE,
  isOfficialMarketplaceGitSource,
  isMarketplaceListingSupported,
  pluginMarketplaceGitSourceSchema,
  type PluginMarketplaceEntry,
  type PluginMarketplaceGitSource
} from '../../../shared/plugins/catalog/plugin-marketplace'
import {
  fetchPluginMarketplace,
  type PluginMarketplaceFetchResult
} from './plugin-marketplace-fetch'
import {
  marketplaceSourceId,
  PluginMarketplaceStore,
  type PluginMarketplaceCachedSnapshot,
  type PluginMarketplaceRegisteredSource
} from './plugin-marketplace-store'
import type { PluginKillListEntry } from '../../../shared/plugins/catalog/plugin-kill-list'
import type { PluginImageCache } from '../media/plugin-image-cache'
import { validateMarketplaceProvenance } from './plugin-marketplace-provenance'
import { CommunityMarketplaceSeed } from './plugin-community-marketplace-seed'
import { pluginMarketplaceErrorMessage } from './plugin-marketplace-error-message'
import {
  pluginMarketplaceListing,
  pluginMarketplaceSourceState,
  type PluginMarketplaceListing,
  type PluginMarketplaceSourceState
} from './plugin-marketplace-projection'
export type {
  PluginMarketplaceListing,
  PluginMarketplaceSourceState
} from './plugin-marketplace-projection'

type MarketplaceFetcher = (
  source: PluginMarketplaceRegisteredSource
) => Promise<PluginMarketplaceFetchResult>

export class PluginMarketplaceService {
  private readonly offline: boolean
  private readonly store: PluginMarketplaceStore
  private readonly fetcher: MarketplaceFetcher
  private readonly getKillListEntry: (pluginKey: string) => PluginKillListEntry | null
  private readonly hostVersion: string | null
  private readonly imageCache: PluginImageCache | null
  private readonly refreshChains = new Map<string, Promise<PluginMarketplaceSourceState>>()
  private readonly sourceErrors = new Map<string, string>()
  private officialSeedPromise: Promise<PluginMarketplaceSourceState> | null = null
  private officialSeedRequested = false
  private readonly communitySeed: CommunityMarketplaceSeed

  constructor(options: {
    pluginsDataDir: string
    fetcher?: MarketplaceFetcher
    store?: PluginMarketplaceStore
    getKillListEntry?: (pluginKey: string) => PluginKillListEntry | null
    /** Picks which of an entry's releases to offer; without it the newest is offered. */
    hostVersion?: string
    imageCache?: PluginImageCache
    offline?: boolean
  }) {
    this.offline = options.offline ?? false
    this.hostVersion = options.hostVersion ?? null
    this.imageCache = options.imageCache ?? null
    this.store = options.store ?? new PluginMarketplaceStore(options.pluginsDataDir)
    this.fetcher = options.fetcher ?? fetchPluginMarketplace
    this.getKillListEntry = options.getKillListEntry ?? (() => null)
    this.communitySeed = new CommunityMarketplaceSeed(this.store, (source) =>
      this.addSource(source)
    )
  }

  async listSources(): Promise<PluginMarketplaceSourceState[]> {
    await this.waitForOfficialSeed()
    const sources = await this.listAvailableSources()
    return Promise.all(
      sources.map(async (source) => {
        try {
          const error = this.sourceErrors.get(source.id)
          return pluginMarketplaceSourceState(
            source,
            await this.store.readSnapshot(source.id),
            Boolean(error),
            error
          )
        } catch (error) {
          return pluginMarketplaceSourceState(
            source,
            null,
            true,
            pluginMarketplaceErrorMessage(error)
          )
        }
      })
    )
  }

  async addSource(source: PluginMarketplaceGitSource): Promise<PluginMarketplaceSourceState> {
    const parsedSource = pluginMarketplaceGitSourceSchema.parse(source)
    const sourceId = marketplaceSourceId(parsedSource)
    const existing = (await this.store.listSources()).find((candidate) => candidate.id === sourceId)
    const candidate: PluginMarketplaceRegisteredSource = existing ?? {
      id: sourceId,
      source: parsedSource,
      addedAt: Date.now()
    }
    const fetched = await this.fetchAndValidate(candidate)
    const registered = existing ?? (await this.store.addSource(parsedSource, candidate.addedAt))
    try {
      const snapshot = await this.store.writeSnapshot({ source: registered, ...fetched })
      this.sourceErrors.delete(registered.id)
      return pluginMarketplaceSourceState(registered, snapshot, false)
    } catch (error) {
      if (!existing) {
        await this.store.removeSource(registered.id).catch(() => undefined)
      }
      throw error
    }
  }

  async removeSource(sourceId: string): Promise<boolean> {
    const source = (await this.store.listSources()).find((candidate) => candidate.id === sourceId)
    if (source && isOfficialMarketplaceGitSource(source.source.url)) {
      throw new Error('the official marketplace is managed by Orca and cannot be removed')
    }
    const removed = await this.store.removeSource(sourceId)
    if (removed) {
      this.sourceErrors.delete(sourceId)
      if (this.officialSeedRequested) {
        // Recover the managed source when a full profile frees a slot, without restart.
        await this.seedOfficialSource().catch(() => undefined)
      }
    }
    return removed
  }

  seedOfficialSource(): Promise<PluginMarketplaceSourceState> {
    if (this.offline) {
      return Promise.reject(new Error('Online plugin catalogs are disabled in Saker.'))
    }
    this.officialSeedRequested = true
    if (!this.officialSeedPromise) {
      const seed = this.performOfficialSeed()
      this.officialSeedPromise = seed
      void seed.catch(() => {
        if (this.officialSeedPromise === seed) {
          // Store/full-list failures must permit later seeding attempts.
          this.officialSeedPromise = null
        }
      })
    }
    return this.officialSeedPromise
  }

  seedCommunitySource(now?: number): Promise<void> {
    return this.offline ? Promise.resolve() : this.communitySeed.run(now)
  }

  async refreshSource(sourceId: string): Promise<PluginMarketplaceSourceState> {
    const previous = this.refreshChains.get(sourceId) ?? Promise.resolve(null)
    const refresh = previous.catch(() => null).then(() => this.performRefresh(sourceId))
    this.refreshChains.set(sourceId, refresh)
    try {
      return await refresh
    } finally {
      if (this.refreshChains.get(sourceId) === refresh) {
        this.refreshChains.delete(sourceId)
      }
    }
  }

  async refreshAll(): Promise<PluginMarketplaceSourceState[]> {
    await this.waitForOfficialSeed()
    const sources = await this.listAvailableSources()
    return Promise.all(sources.map((source) => this.refreshSource(source.id)))
  }

  async listPlugins(): Promise<PluginMarketplaceListing[]> {
    await this.waitForOfficialSeed()
    return (await this.listCachedPlugins()).sort((left, right) =>
      `${left.pluginKey}\0${left.marketplaceSourceId}`.localeCompare(
        `${right.pluginKey}\0${right.marketplaceSourceId}`
      )
    )
  }

  async listCachedPlugins(): Promise<PluginMarketplaceListing[]> {
    const states = await this.listSnapshots()
    return states.flatMap(({ source, snapshot }) =>
      snapshot.marketplace.plugins
        .filter((entry) => isMarketplaceListingSupported(entry.categories))
        .map((entry) => this.listingFromEntry(source, snapshot, entry))
    )
  }

  async findPlugin(
    marketplaceSourceId: string,
    pluginKey: string
  ): Promise<PluginMarketplaceListing | null> {
    const source = (await this.listAvailableSources()).find(
      (candidate) => candidate.id === marketplaceSourceId
    )
    if (!source) {
      return null
    }
    const snapshot = await this.store.readSnapshot(source.id)
    const entry = snapshot?.marketplace.plugins.find(
      (plugin) => plugin.id === pluginKey && isMarketplaceListingSupported(plugin.categories)
    )
    return snapshot && entry ? this.listingFromEntry(source, snapshot, entry) : null
  }

  private async performRefresh(sourceId: string): Promise<PluginMarketplaceSourceState> {
    const source = (await this.listAvailableSources()).find(
      (candidate) => candidate.id === sourceId
    )
    if (!source) {
      throw new Error(`unknown marketplace source: ${sourceId}`)
    }
    try {
      const fetched = await this.fetchAndValidate(source)
      const snapshot = await this.store.writeSnapshot({ source, ...fetched })
      this.sourceErrors.delete(source.id)
      return pluginMarketplaceSourceState(source, snapshot, false)
    } catch (error) {
      const cached = await this.store.readSnapshot(source.id).catch(() => null)
      if (!cached) {
        throw error
      }
      const message = pluginMarketplaceErrorMessage(error)
      this.sourceErrors.set(source.id, message)
      return pluginMarketplaceSourceState(source, cached, true, message)
    }
  }

  private async performOfficialSeed(): Promise<PluginMarketplaceSourceState> {
    const sources = await this.store.listSources()
    const existing = sources.find((source) => isOfficialMarketplaceGitSource(source.source.url))
    const source =
      existing ?? (await this.store.addSource(OFFICIAL_MARKETPLACE_GIT_SOURCE, Date.now()))
    const snapshot = await this.store.readSnapshot(source.id).catch(() => null)
    if (snapshot) {
      return pluginMarketplaceSourceState(source, snapshot, false)
    }
    try {
      return await this.performRefresh(source.id)
    } catch (error) {
      // Keep official source configuration offline so later refreshes need no user-supplied URL.
      const message = pluginMarketplaceErrorMessage(error)
      this.sourceErrors.set(source.id, message)
      return pluginMarketplaceSourceState(source, null, true, message)
    }
  }

  private async waitForOfficialSeed(): Promise<void> {
    await this.officialSeedPromise?.catch(() => undefined)
    await this.communitySeed.settled()
  }

  private listAvailableSources(): Promise<readonly PluginMarketplaceRegisteredSource[]> {
    return this.offline ? Promise.resolve([]) : this.store.listSources()
  }

  private async fetchAndValidate(
    source: PluginMarketplaceRegisteredSource
  ): Promise<PluginMarketplaceFetchResult> {
    if (this.offline) {
      throw new Error('Online plugin catalogs are disabled in Saker.')
    }
    const fetched = await this.fetcher(source)
    validateMarketplaceProvenance(source, fetched)
    const cache = this.imageCache
    if (cache) {
      await Promise.all(
        (fetched.images ?? []).map((image) =>
          cache.put(image).catch((error: unknown) => {
            console.warn('[plugins] could not cache marketplace image:', error)
            return null
          })
        )
      )
    }
    return fetched
  }

  private async listSnapshots(): Promise<
    { source: PluginMarketplaceRegisteredSource; snapshot: PluginMarketplaceCachedSnapshot }[]
  > {
    const sources = await this.listAvailableSources()
    const snapshots = await Promise.all(
      sources.map(async (source) => ({
        source,
        snapshot: await this.store.readSnapshot(source.id)
      }))
    )
    return snapshots.filter(
      (
        candidate
      ): candidate is {
        source: PluginMarketplaceRegisteredSource
        snapshot: PluginMarketplaceCachedSnapshot
      } => candidate.snapshot !== null
    )
  }

  private listingFromEntry(
    source: PluginMarketplaceRegisteredSource,
    snapshot: PluginMarketplaceCachedSnapshot,
    entry: PluginMarketplaceEntry
  ): PluginMarketplaceListing {
    return pluginMarketplaceListing({
      source,
      snapshot,
      entry,
      hostVersion: this.hostVersion,
      blocked: this.getKillListEntry(entry.id)
    })
  }
}
