export class EIP6963ProviderStore {
  private providers: EIP6963ProviderDetail[] = [];
  private listeners: Array<() => void> = [];
  private initialized = false;

  private ensureInitialized() {
    // Only initialize when we're in the browser and haven't initialized yet
    if (!this.initialized && typeof window !== 'undefined') {
      console.log('EIP6963ProviderStore: Initializing...');
      this.setupEventListeners();
      this.initialized = true;
    } else {
      console.log('EIP6963ProviderStore: Cannot initialize - not in browser environment');
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
    const result = this.providers.find(provider =>
      provider.info.name.toLowerCase().includes(name.toLowerCase())
    );
    return result;
  }

  getMetaMaskProvider(): EIP6963ProviderDetail | undefined {
    this.ensureInitialized();
    const result = this.providers.find(provider =>
      provider.info.name.toLowerCase().includes('metamask') ||
      provider.info.rdns === 'io.metamask'
    );
    return result;
  }

  getRabbyProvider(): EIP6963ProviderDetail | undefined {
    this.ensureInitialized();
    const result = this.providers.find(provider =>
      provider.info.name.toLowerCase().includes('rabby') ||
      provider.info.rdns === 'io.rabby'
    );
    return result;
  }

  getCoinbaseProvider(): EIP6963ProviderDetail | undefined {
    this.ensureInitialized();
    return this.providers.find(provider =>
      provider.info.name.toLocaleLowerCase().includes('coinbase') ||
      provider.info.rdns === 'io.coinbase'
    );
  }

  getAllWalletProviders(): EIP6963ProviderDetail[] {
    this.ensureInitialized();
    console.log(`getAllWalletProviders() called, returning ${this.providers.length} providers`);
    console.log('Provider details:', this.providers.map(p => ({ name: p.info.name, rdns: p.info.rdns })));
    return [...this.providers];
  }

  getProviderByRdns(rdns: string): EIP6963ProviderDetail | undefined {
    this.ensureInitialized();
    return this.providers.find(provider => provider.info.rdns === rdns);
  }

  getProviderCount(): number {
    this.ensureInitialized();
    return this.providers.length;
  }

  detectProviderConflicts(): ConflictReport {
    this.ensureInitialized();

    const conflicts: ConflictReport = {
      hasConflicts: false,
      conflictingProviders: [],
      recommendations: []
    };

    const walletTypes = new Map<string, EIP6963ProviderDetail[]>();

    this.providers.forEach(provider => {
      const walletType = this.getWalletType(provider.info.rdns)
      if (!walletTypes.has(walletType)) {
        walletTypes.set(walletType, []);
      }
      walletTypes.get(walletType)!.push(provider);
    })

    // Check for conflicts 
    walletTypes.forEach((providers, walletType) => {
      if (providers.length > 1) {
        conflicts.hasConflicts = true;
        providers.forEach(provider => {
          conflicts.conflictingProviders.push({
            rdns: provider.info.rdns,
            name: provider.info.name,
            conflictType: 'duplicate'
          });
        });
        conflicts.recommendations.push(
          `Multiple ${walletType} providers detected. Consider disabling wallet extensions you do not (want to) use.`
        );
      }
    })

    return conflicts;
  }

  private getWalletType(rdns: string): string {
    if (rdns.includes('metamask')) return 'MetaMask';
    if (rdns.includes('coinbase')) return 'Coinbase';
    if (rdns.includes('rabby')) return 'Rabby';
    return 'Unknown';
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