import type { ZeroStore } from './ZeroStore';
import BigNumber from 'bignumber.js';
import { NETWORK_LIST } from '../config/constants/network';
import { action, extendObservable } from 'mobx';

export default class FeeStore {
	private readonly store!: ZeroStore;
	private gasInterval: NodeJS.Timeout | undefined;
	public gasFee: BigNumber | undefined;
	public mintFee: BigNumber | undefined;

	constructor(store: ZeroStore) {
		this.store = store;
		extendObservable(this, {
			gasFee: undefined,
			mintFee: undefined,
		});
	}

	/* ETH gas prices based on https://gasnow.org/
	 */
	private async _gasnowPrices(): Promise<BigNumber> {
		const prices = await fetch('https://www.gasnow.org/api/v3/gas/price?utm_source=badgerv2');
		const result = await prices.json();
		// keepers use 'Rapid' gas prices to handle transactions, so we only are interested in this.
		return new BigNumber(result.data['rapid']).multipliedBy(1e9);
	}

	/* Pull mint fee from renJS
	 */
	private async _getRenMintFee(): Promise<BigNumber> {
		const renJS = this.store.wallet.network.renJS;
		const fees = await renJS.getFees();
		console.log('fees:', fees);
		return new BigNumber(fees.btc.ethereum.mint).dividedBy(1e2);
	}

	/* Pulls data for the current network and sets the gas fee to
	 * the appropriate amount, stored in wei.  We poll this every 8
	 * seconds per gasNow's standard updates.
	 */
	setFees = action(() => {
		switch (this.store.wallet.network.name) {
			case NETWORK_LIST.ETH:
				this._gasnowPrices().then((value: BigNumber) => {
					this.gasFee = value;
				});
				this._getRenMintFee().then((value: BigNumber) => {
					this.mintFee = value;
				});
				this.gasInterval = setInterval(() => {
					this._gasnowPrices().then((value: BigNumber) => {
						this.gasFee = value;
					});
				}, 1000 * 8);
		}
	});

	cancelGasInterval = () => {
		if (this.gasInterval) clearInterval(this.gasInterval);
	};
}