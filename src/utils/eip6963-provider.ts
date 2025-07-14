export class EIP6963ProviderStore {
  private providers: EIP6963ProviderDetail[] = [];
  private listeners: Array<() => void> = [];
  private initialized = false;

  private ensureInitialized() {
    // Only initialize when we're in the browser and haven't initialized yet
    if (!this.initialized && typeof window !== 'undefined') {
      this.setupEventListeners();
      this.initialized = true;
    }
  }

  private setupEventListeners() {
    const handleProviderAnnouncement = (event: Event) => {
      const customEvent = event as EIP6963AnnounceProviderEvent;
      this.handleProviderAnnouncement(customEvent.detail);
    };
    
    window.addEventListener('eip6963:announceProvider', handleProviderAnnouncement);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  private handleProviderAnnouncement(providerDetail: EIP6963ProviderDetail) {
    const existingProvider = this.providers.find(p => p.info.uuid === providerDetail.info.uuid);
    if (existingProvider) {
      return;
    }

    this.providers.push(providerDetail);
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  getProviders(): EIP6963ProviderDetail[] {
    this.ensureInitialized();
    return [...this.providers];
  }

  getProviderByName(name: string): EIP6963ProviderDetail | undefined {
    this.ensureInitialized();
    return this.providers.find(provider => 
      provider.info.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  getMetaMaskProvider(): EIP6963ProviderDetail | undefined {
    this.ensureInitialized();
    return this.getProviderByName('metamask');
  }

  subscribe(listener: () => void): () => void {
    this.ensureInitialized();
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

export const eip6963Store = new EIP6963ProviderStore();