import { Contract, ethers, providers, utils } from 'ethers';
import Head from 'next/head';
import React, { useEffect, useRef, useState } from 'react';
import Web3Modal from 'web3modal';
import { abi, NFT_CONTRACT_ADDRESS, wlAddresses } from '../constants';
import styles from '../styles/Home.module.css';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export default function Home() {
	// walletConnected keep track of whether the user's wallet is connected or not
	const [ walletConnected, setWalletConnected ] = useState(false);
	// whitelisted keep track of whether the user's wallet is connected or not
	const [ whitelisted, setWhitelisted ] = useState(false);
	// presaleStarted keeps track of whether the presale has started or not
	const [ presaleStarted, setPresaleStarted ] = useState(false);
	// publicStarted keeps track of whether the public has started or not
	const [ publicStarted, setPublicStarted ] = useState(false);
	// loading is set to true when we are waiting for a transaction to get mined
	const [ loading, setLoading ] = useState(false);
	// tokenIdsMinted keeps track of the number of tokenIds that have been minted
	const [ tokenIdsMinted, setTokenIdsMinted ] = useState('0');
	// Create a reference to the Web3 Modal (used for connecting to Metamask) which persists as long as the page is open
	const [ minted, setMinted ] = useState(false);

	const [ amountToMint, setAmountToMint ] = useState(1);

	const web3ModalRef = useRef();

	const leaves = wlAddresses.map((addr) => ethers.utils.keccak256(addr));
	const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
	const root = tree.getHexRoot();
	console.log(root);

	/**
   * presaleMint: Mint an NFT during the presale
   */
	const whitelistMint = async () => {
		try {
			const signer = await getProviderOrSigner(true);
			// Create a new instance of the Contract with a Signer, which allows
			// update methods
			const whitelistContract = new Contract(NFT_CONTRACT_ADDRESS, abi, signer);
			const signerAddress = await signer.getAddress();
			const leaf = ethers.utils.keccak256(signerAddress);
			const leafIndex = leaves.indexOf(leaf);
			const proof = tree.getHexProof(leaf, leafIndex);
			// call the presaleMint from the contract, only whitelisted addresses would be able to mint
			const tx = await whitelistContract.whitelistMint(proof, {
				// We are parsing `0.01` string to ether using the utils library from ethers.js
				value: utils.parseEther('0.01')
			});
			setLoading(true);
			// wait for the transaction to get mined
			await tx.wait();
			setLoading(false);
		} catch (err) {
			console.error(err);
		}
	};

	/**
   * publicMint: Mint an NFT after the presale
   */
	const publicMint = async () => {
		try {
			// We need a Signer here since this is a 'write' transaction.
			const signer = await getProviderOrSigner(true);
			// Create a new instance of the Contract with a Signer, which allows
			// update methods
			const whitelistContract = new Contract(NFT_CONTRACT_ADDRESS, abi, signer);
			// call the mint from the contract to mint the Crypto Dev
			const totalAmount = `${amountToMint * 0.01}`;
			const tx = await whitelistContract.publicMint(amountToMint, {
				// value signifies the cost of one crypto dev which is "0.01" eth.
				// We are parsing `0.01` string to ether using the utils library from ethers.js
				value: utils.parseEther(totalAmount)
			});
			setLoading(true);
			// wait for the transaction to get mined
			await tx.wait();
			setLoading(false);
			window.alert('wow degen, your star looks lucky!');
		} catch (err) {
			console.error(err);
		}
	};

	/*
      connectWallet: Connects the MetaMask wallet
    */
	const connectWallet = async () => {
		try {
			// Get the provider from web3Modal, which in our case is MetaMask
			// When used for the first time, it prompts the user to connect their wallet
			await getProviderOrSigner();
			setWalletConnected(true);
		} catch (err) {
			console.error(err);
		}
	};

	/**
   * checkIfPresaleStarted: checks if the presale has started by quering the `presaleStarted`
   * variable in the contract
   */
	const checkIfPresaleStarted = async () => {
		try {
			// Get the provider from web3Modal, which in our case is MetaMask
			// No need for the Signer here, as we are only reading state from the blockchain
			const provider = await getProviderOrSigner();
			// We connect to the Contract using a Provider, so we will only
			// have read-only access to the Contract
			const nftContract = new Contract(NFT_CONTRACT_ADDRESS, abi, provider);
			// call the presaleStarted from the contract
			const _presaleStarted = await nftContract.isWhitelist();
			setPresaleStarted(_presaleStarted);
			return _presaleStarted;
		} catch (err) {
			console.error(err);
			return false;
		}
	};

	const checkIfPublicStarted = async () => {
		try {
			const provider = await getProviderOrSigner();
			const nftContract = new Contract(NFT_CONTRACT_ADDRESS, abi, provider);
			const _publicStarted = await nftContract.isPublic();
			setPublicStarted(_publicStarted);
			return _publicStarted;
		} catch (err) {
			console.error(err);
			return false;
		}
	};

	const checkIfWhitelisted = async () => {
		try {
			const signer = await getProviderOrSigner(true);
			const signerAddress = await signer.getAddress();
			const leaf = ethers.utils.keccak256(signerAddress);
			const _whitelisted = leaves.indexOf(leaf) !== -1;
			setWhitelisted(_whitelisted);
		} catch (err) {
			console.error(err);
			return false;
		}
	};

	const checkIfMinted = async () => {
		try {
			const signer = await getProviderOrSigner(true);
			const signerAddress = await signer.getAddress();
			const nftContract = new Contract(NFT_CONTRACT_ADDRESS, abi, signer);
			const _count = await nftContract.publicMintedCount(signerAddress);
			const _minted = _count.toNumber() === 5;
			setMinted(_minted);
			return _minted;
		} catch (err) {
			console.error(err);
			return false;
		}
	};

	/**
   * getTokenIdsMinted: gets the number of tokenIds that have been minted
   */
	const getTokenIdsMinted = async () => {
		try {
			// Get the provider from web3Modal, which in our case is MetaMask
			// No need for the Signer here, as we are only reading state from the blockchain
			const provider = await getProviderOrSigner();
			// We connect to the Contract using a Provider, so we will only
			// have read-only access to the Contract
			const nftContract = new Contract(NFT_CONTRACT_ADDRESS, abi, provider);
			// call the tokenIds from the contract
			const _tokenIds = await nftContract.totalSupply() -1;
			//_tokenIds is a `Big Number`. We need to convert the Big Number to a string
			setTokenIdsMinted(_tokenIds.toString());
		} catch (err) {
			console.error(err);
		}
	};

	/**
   * Returns a Provider or Signer object representing the Ethereum RPC with or without the
   * signing capabilities of metamask attached
   *
   * A `Provider` is needed to interact with the blockchain - reading transactions, reading balances, reading state, etc.
   *
   * A `Signer` is a special type of Provider used in case a `write` transaction needs to be made to the blockchain, which involves the connected account
   * needing to make a digital signature to authorize the transaction being sent. Metamask exposes a Signer API to allow your website to
   * request signatures from the user using Signer functions.
   *
   * @param {*} needSigner - True if you need the signer, default false otherwise
   */
	const getProviderOrSigner = async (needSigner = false) => {
		// Connect to Metamask
		// Since we store `web3Modal` as a reference, we need to access the `current` value to get access to the underlying object
		const provider = await web3ModalRef.current.connect();
		const web3Provider = new providers.Web3Provider(provider);

		// If user is not connected to the Rinkeby network, let them know and throw an error
		const { chainId } = await web3Provider.getNetwork();
		if (chainId !== 5) {
			// window.alert('change the network to ethereum mainnet');
			throw new Error('change network to ethereum mainnet');
		}

		if (needSigner) {
			const signer = web3Provider.getSigner();
			return signer;
		}
		return web3Provider;
	};

	// useEffects are used to react to changes in state of the website
	// The array at the end of function call represents what state changes will trigger this effect
	// In this case, whenever the value of `walletConnected` changes - this effect will be called
	useEffect(
		() => {
			// if wallet is not connected, create a new instance of Web3Modal and connect the MetaMask wallet
			if (!walletConnected) {
				// Assign the Web3Modal class to the reference object by setting it's `current` value
				// The `current` value is persisted throughout as long as this page is open
				web3ModalRef.current = new Web3Modal({
					network: 'goerli',
					providerOptions: {},
					disableInjectedProvider: false
				});
				connectWallet();

				checkIfPublicStarted();
				// Check if presale has started and ended
				checkIfPresaleStarted();

				getTokenIdsMinted();

				// Set an interval which gets called every 5 seconds to check presale has ended
				const publicStartedInterval = setInterval(async function() {
					const _presaleStarted = await checkIfPresaleStarted();
					if (_presaleStarted) {
						const _publicStarted = await checkIfPublicStarted();
						if (_publicStarted) {
							clearInterval(publicStartedInterval);
						}
					}
				}, 5 * 1000);

				// set an interval to get the number of token Ids minted every 5 seconds
				setInterval(async function() {
					await getTokenIdsMinted();
				}, 5 * 1000);
			}
			checkIfWhitelisted();

			const mintedInterval = setInterval(async function() {
				const _minted = await checkIfMinted();
				if (_minted) {
					clearInterval(mintedInterval);
				}
			}, 2 * 1000);
		},
		[ walletConnected ]
	);

	/*
      renderButton: Returns a button based on the state of the dapp
    */
	const renderButton = () => {
		// If wallet is not connected, return a button which allows them to connect their wllet
		if (!walletConnected) {
			return (
				<button onClick={connectWallet} className={styles.button}>
					pls connect your wallet
				</button>
			);
		}

		// If we are currently waiting for something, return a loading button
		if (loading) {
			return (
				<div>
					<button className={styles.button}>loading...</button>
					<div className={styles.footer}>{tokenIdsMinted}/111s have been minted</div>
				</div>
			);
		}

		if (minted) {
			return (
				<div>
					<div className={styles.description}>you have minted maximum amount</div>
					<div className={styles.footer}>{tokenIdsMinted}/111 have been minted</div>
				</div>
			);
		}

		if (publicStarted) {
			return (
				<div>
					<div className={styles.description}>
						amount to mint: {amountToMint}
						<div>
							<button
								className={styles.smolbutton}
								onClick={() => {
									if (amountToMint > 1) {
										setAmountToMint(amountToMint - 1);
									}
								}}
							>
								-
							</button>
							<button
								className={styles.smolbutton}
								onClick={() => {
									if (amountToMint < 5) {
										setAmountToMint(amountToMint + 1);
									} else {
										window.alert(`you can't mint more than 5`);
									}
								}}
							>
								+
							</button>
						</div>
					</div>
					<button className={styles.button} onClick={publicMint}>
						public mint
					</button>
					<div className={styles.description}> BA DUM TIS </div>
					<div className={styles.footer}>{tokenIdsMinted}/111 have been minted</div>
				</div>
			);
		}

		// If presale hasn't started yet, tell them that
		if (!presaleStarted) {
			return (
				<div>
					<div className={styles.description}>minting period hasn't started yet</div>
				</div>
			);
		}

		// If presale started, but hasn't ended yet, allow for minting during the presale period
		if (whitelisted && presaleStarted) {
			return (
				<div>
					<div className={styles.description}>Looks like you are whitelisted!</div>
					<button className={styles.button} onClick={whitelistMint}>
						whitelist mint
					</button>
					<div className={styles.description}> Wait, press that button slowly </div>
					<div className={styles.footer}>{tokenIdsMinted}/111 have been minted</div>
				</div>
			);
		}

		// If presale started, hasn't ended yet, but not whitelisted
		if (!whitelisted && presaleStarted) {
			return (
				<div>
					<div className={styles.description}>you don't seem whitelisted. try public mint</div>
					<div className={styles.footer}>{tokenIdsMinted}/111 have been minted</div>
				</div>
			);
		}
	};

	return (
		<div>
		  <Head>
			<title>NFT Tutorial</title>
			<meta name="description" content="Whitelist-Dapp" />
			<link rel="icon" href="/favicon.ico" />
		  </Head>
		  <div className={styles.main}>
			<div>
			  <h1 className={styles.title}> Here comes the Mint page </h1>
			  
			  {renderButton()}
			</div>
			<div>
				
			</div>
		  </div>
	
		  <footer className={styles.footer}>
			Made with &#10084; by <a className={styles.a} href="https://twitter.com/odtublockchain" ><img className={styles.image} src="/logo.png"/></a>
		  </footer>
		</div>
	  );
	}