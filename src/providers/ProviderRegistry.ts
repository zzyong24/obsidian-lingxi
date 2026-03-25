/**
 * Provider 注册与管理
 * 管理所有模型提供商实例，提供统一的访问接口
 */

import { ProviderConfig, AIChatSettings } from '@/types';
import { OpenAICompatibleProvider } from './OpenAICompatible';

export class ProviderRegistry {
  private providers: Map<string, OpenAICompatibleProvider> = new Map();
  private providerConfigs: Map<string, ProviderConfig> = new Map();

  /**
   * 根据设置初始化所有提供商
   */
  initialize(settings: AIChatSettings): void {
    this.providers.clear();
    this.providerConfigs.clear();
    for (const config of settings.providers) {
      if (config.apiKey) {
        this.registerProvider(config);
      }
    }
  }

  /**
   * 注册一个提供商
   */
  registerProvider(config: ProviderConfig): void {
    const provider = new OpenAICompatibleProvider(
      config.baseUrl,
      config.apiKey,
      config.defaultModel,
    );
    this.providers.set(config.id, provider);
    this.providerConfigs.set(config.id, config);
  }

  /**
   * 获取提供商实例
   */
  getProvider(providerId: string): OpenAICompatibleProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * 根据模型字符串（格式: providerId:modelName）获取提供商和模型
   */
  resolveModel(modelString: string): { provider: OpenAICompatibleProvider; model: string } | null {
    const colonIndex = modelString.indexOf(':');
    if (colonIndex === -1) return null;
    const providerId = modelString.substring(0, colonIndex);
    const modelName = modelString.substring(colonIndex + 1);
    const provider = this.providers.get(providerId);
    if (!provider) return null;
    return { provider, model: modelName || '' };
  }

  /**
   * 获取当前可用的提供商 ID 列表
   */
  getAvailableProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 获取默认提供商（第一个有 API Key 的）
   */
  getDefaultProvider(): OpenAICompatibleProvider | undefined {
    const firstEntry = this.providers.entries().next();
    return firstEntry.done ? undefined : firstEntry.value[1];
  }

  /**
   * 获取提供商的原始配置
   */
  getProviderConfig(providerId: string): ProviderConfig | undefined {
    // 需要从 settings 中查找配置
    return this.providerConfigs.get(providerId);
  }
}
