import { useEffect, useMemo, useState } from 'react';
import { getCachedCompatQuirks, readCompatQuirks, subscribeCompatQuirks, EMPTY_QUIRKS } from '../services/ai-compat-memory';
import { getThinkingLock, getThinkingStops, resolveModelBehavior, UNKNOWN_REASONING, type ThinkingLock } from '../services/ai-model-capabilities';
import { getProviderCapabilities } from '../services/ai-provider-discovery';
import type { AICompatQuirks, AIModelProfile, AIProviderConfig, AIProviderProfile, AIReasoningCapability, AIReasoningSetting } from '../services/ai-provider-types';
import { getActiveModel, getActiveProvider, getSettings, subscribeSettings, toProviderConfig, type AISettings } from '../services/settings';

export interface ActiveAIModel {
    settings: AISettings | null;
    provider?: AIProviderProfile;
    model?: AIModelProfile;
    /** Config with the protocol that will actually be used. */
    config?: AIProviderConfig;
    capability: AIReasoningCapability;
    quirks: AICompatQuirks;
    stops: AIReasoningSetting[];
    lock: ThinkingLock | null;
}

function effectiveConfig(provider?: AIProviderProfile, model?: AIModelProfile): AIProviderConfig | undefined {
    if (!provider || !model?.model.trim()) return undefined;
    const config = toProviderConfig(provider, model);
    return config.protocolPreference === 'auto' ? config : { ...config, protocol: config.protocolPreference };
}

/** The active provider/model and what its thinking slider may offer; follows settings and learned quirks live. */
export function useActiveAIModel(enabled = true): ActiveAIModel {
    const [settings, setSettings] = useState<AISettings | null>(null);
    const [metadataReasoning, setMetadataReasoning] = useState<{ key: string; value: AIReasoningCapability } | null>(null);
    const [quirkVersion, setQuirkVersion] = useState(0);

    useEffect(() => {
        if (!enabled) return undefined;
        let mounted = true;
        const unsubscribe = subscribeSettings((value) => { if (mounted) setSettings(value); });
        getSettings().then((value) => { if (mounted) setSettings(value); }).catch(() => undefined);
        const unsubscribeQuirks = subscribeCompatQuirks(() => { if (mounted) setQuirkVersion((value) => value + 1); });
        return () => { mounted = false; unsubscribe(); unsubscribeQuirks(); };
    }, [enabled]);

    const provider = settings ? getActiveProvider(settings) : undefined;
    const model = getActiveModel(provider);
    const config = useMemo(() => effectiveConfig(provider, model), [provider, model]);
    const key = config ? JSON.stringify([config.providerId, config.connectionRevision, config.model, config.protocol, config.capabilityOverrides ?? null]) : '';

    useEffect(() => {
        if (!config) return undefined;
        let current = true;
        // Cached catalog metadata may describe the model better than name rules; the key is optional here.
        getProviderCapabilities(config).then((value) => { if (current) setMetadataReasoning({ key, value: value.reasoning }); }).catch(() => undefined);
        readCompatQuirks(config, config.protocol).then(() => { if (current) setQuirkVersion((value) => value + 1); }).catch(() => undefined);
        return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return useMemo(() => {
        if (!config) {
            return { settings, provider, model, capability: UNKNOWN_REASONING, quirks: EMPTY_QUIRKS, stops: [], lock: null };
        }
        const capability = metadataReasoning?.key === key ? metadataReasoning.value : resolveModelBehavior(config).reasoning;
        const quirks = getCachedCompatQuirks(config, config.protocol) ?? EMPTY_QUIRKS;
        return {
            settings, provider, model, config, capability, quirks,
            stops: getThinkingStops(config.protocol, capability, quirks),
            lock: getThinkingLock(capability, quirks),
        };
    // quirkVersion re-reads the synchronous quirk cache after it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings, provider, model, config, key, metadataReasoning, quirkVersion]);
}
