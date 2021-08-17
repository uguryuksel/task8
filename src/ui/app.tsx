/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';
import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { AddressTranslator } from 'nervos-godwoken-integration';
import * as CompiledContractArtifact from '../../build/contracts/ERC20.json';
import { QuotesWrapper } from '../lib/contracts/QuotesWrapper';
import { CONFIG } from '../config';
import { IQuote, IOriginalQuote } from '../types/Quote';
import * as helpers from './helpers';

async function createWeb3() {
    // Modern dapp browsers...
    if ((window as any).ethereum) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };

        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider || Web3.givenProvider);

        try {
            // Request account access if needed
            await (window as any).ethereum.enable();
        } catch (error) {
            // User denied account access...
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [sudtBalance, setSudtBalance] = useState<string>();
    const [ckethBalance, setCkethBalance] = useState<string>();
    const [depositAddress, setDepositAddress] = useState<string>();
    const [web3, setWeb3] = useState<Web3>(null);
    const [contract, setContract] = useState<QuotesWrapper>();
    const [accounts, setAccounts] = useState<string[]>();
    const [l2Balance, setL2Balance] = useState<bigint>();
    const [polyjuiceAddress, setPolyjuiceAddress] = useState<string | undefined>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const toastId = React.useRef(null);

    const [author, setAuthor] = useState<string>();
    const [content, setContent] = useState<string>();
    const [selectedQuotes, setSelectedQuotes] = useState<IQuote[]>();
    const [loading, setLoading] = useState<boolean>(false);
    const [totalQuotes, setTotalQuotes] = useState<number>(0);
    const [balanceLoading, setBalanceLoading] = useState<boolean>();
    function getRandomIndex(max: number) {
        const min = 1;
        const _max = Math.floor(max);
        return Math.floor(Math.random() * (_max + 1 - min) + min);
    }

    useEffect(() => {
        if (accounts?.[0]) {
            const addressTranslator = new AddressTranslator();
            setPolyjuiceAddress(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]));
        } else {
            setPolyjuiceAddress(undefined);
        }
    }, [accounts?.[0]]);

    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog and please wait...',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    useEffect(() => {
        if (web3 && polyjuiceAddress && contract && accounts) {
            getCkethBalance();
            getSudtBalance();
        }
    }, [web3, polyjuiceAddress, contract, accounts]);

    const account = accounts?.[0];
    async function refreshBalances() {
        setBalanceLoading(true);
        await getCkethBalance();
        await getCkbBalance();
        setBalanceLoading(false);
    }
    async function getCkethBalance() {
        const _contractCketh = new web3.eth.Contract(
            CompiledContractArtifact.abi as any,
            helpers.CKETH_CONTRACT_ADDRESS
        );

        const _balanceCketh = await _contractCketh.methods.balanceOf(polyjuiceAddress).call({
            from: accounts?.[0]
        });

        setCkethBalance(_balanceCketh);
    }

    async function getCkbBalance() {
        const _l2Balance = BigInt(await web3.eth.getBalance(accounts?.[0]));
        setL2Balance(_l2Balance);
    }

    async function getSudtBalance() {
        const _contractSudt = new web3.eth.Contract(
            CompiledContractArtifact.abi as any,
            helpers.SUDT_CONTRACT_ADDRESS
        );

        const _balanceSudt = await _contractSudt.methods.balanceOf(polyjuiceAddress).call({
            from: accounts?.[0]
        });

        setSudtBalance(_balanceSudt);
    }

    async function getDepositAddress() {
        const addressTranslator = new AddressTranslator();
        const _depositAddress = await addressTranslator.getLayer2DepositAddress(
            web3,
            accounts?.[0]
        );
        setDepositAddress(_depositAddress.addressString);
    }

    function convertQuoteType(originalQuote: IOriginalQuote) {
        return {
            quoteId: originalQuote.quoteId,
            owner: originalQuote.owner,
            author: originalQuote.author,
            content: originalQuote.content
        };
    }

    function changeCkethBase(number: string, ndecimals: number) {
        if (number.length > ndecimals) {
            return `${number.substring(0, number.length - ndecimals)}.${number
                .substring(number.length - ndecimals)
                .replace(/0+/, '')}`;
        }
        const nzeros = ndecimals - number.length;
        const newnumber = `0.${String('0').repeat(nzeros)}${number.replace(/0+/, '')}`;
        return newnumber;
    }

    async function showRandomQuotes() {
        setSelectedQuotes([]);
        setLoading(true);
        const _selectedQuotes = [];
        const maxQoute = Number(await contract.getTotal(account));
        for (let i = 1; i <= 3; i++) {
            let quote;
            quote = await contract.getQuote(getRandomIndex(maxQoute), account);
            if (i !== 1) {
                for (const _quote of _selectedQuotes) {
                    if (_quote.quoteId === quote.quoteId) {
                        quote = await contract.getQuote(getRandomIndex(maxQoute), account);
                    }
                }
            }
            const newQuote = convertQuoteType(quote);
            _selectedQuotes.push(newQuote);
        }
        setSelectedQuotes(_selectedQuotes);
        setLoading(false);
        toast('You have 3 inspiring quotes.', { type: 'success' });
    }

    async function createQuote() {
        if (!author || !content) {
            return;
        }
        try {
            setTransactionInProgress(true);
            await contract.createQuote(author, content, account);
            const _totalQuotes = Number(await contract.getTotal(accounts?.[0]));
            setTotalQuotes(_totalQuotes);
            toast('Successfully created a new quote', { type: 'success' });
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);
            console.log({ _accounts });
            const _contract = new QuotesWrapper(_web3);
            setContract(_contract);

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setL2Balance(_l2Balance);

                const _totalQuotes = Number(await _contract.getTotal(_accounts[0]));
                setTotalQuotes(_totalQuotes);
            }
        })();
    });

    const LoadingIndicator = () => <span className="rotating-icon">⚙️</span>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ marginBottom: '0' }}>Inspiring Quotes</h1>
            <small>Create quotes, show existing quotes randomly</small>
            <div className="header" style={{ marginTop: '1rem' }}>
                Your ETH address: <b>{accounts?.[0]}</b>
                <br />
                <br />
                Your Polyjuice address: <b>{polyjuiceAddress || ' - '}</b>
                <br />
                <br />
                Nervos Layer 2 balance:{' '}
                <b>
                    {l2Balance && !balanceLoading ? (
                        (l2Balance / 10n ** 8n).toString()
                    ) : (
                        <LoadingIndicator />
                    )}{' '}
                    CKB
                </b>
                <br />
                <br />
                ckETH:
                <b>
                    {ckethBalance && !balanceLoading ? (
                        changeCkethBase(ckethBalance.toString(), 18)
                    ) : (
                        <LoadingIndicator />
                    )}{' '}
                    ckETH
                </b>
                <br />
                <br />
                SUDT:
                <b>
                    {sudtBalance ? (sudtBalance as string) : <LoadingIndicator />} Letter Token:ID|
                    {helpers.SUDT_ID}
                </b>
                <br />
                <br />
                <small>
                    {' '}
                    <button onClick={refreshBalances} style={{ backgroundColor: 'orange' }}>
                        🌀 Reload Balances
                    </button>{' '}
                </small>
            </div>

            <br />
            <br />
            <br />
            <div>
                <button onClick={getDepositAddress}>GET LAYER2 DEPOSIT ADDRESS</button>
                <br />
                <br />
                {depositAddress && (
                    <div>
                        {' '}
                        <p
                            style={{
                                overflowWrap: 'break-word',
                                wordWrap: 'break-word',
                                width: '50vw'
                            }}
                        >
                            {depositAddress}
                        </p>
                        <br />
                        <br />
                        <p>💁 With your layer2 deposit address, you can deposit via Force Bridge</p>
                        <br />
                        <br />
                        <button
                            style={{ backgroundColor: 'orange' }}
                            onClick={() => window.open(helpers.FORCE_BRIDGE_URL, '_blank')}
                        >
                            FORCE BRIDGE
                        </button>
                    </div>
                )}
                <hr />
            </div>
            <br />
            <br />
            <div
                className="create-quote"
                style={{ display: 'flex', flexDirection: 'column', width: '40vw' }}
            >
                <input
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    placeholder="Author name..."
                />
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Inspiring Quote"
                />

                <button onClick={createQuote}>Share Quote</button>
            </div>

            <div className="show-quotes" style={{ margin: '1rem' }}>
                <p>
                    {' '}
                    <b>Total Quotes:</b> {totalQuotes > 0 ? totalQuotes : <LoadingIndicator />}
                </p>
                <button onClick={showRandomQuotes} style={{ margin: '1rem' }}>
                    Show 3 Random Quotes
                </button>
                {loading && <LoadingIndicator />}
                {!loading &&
                    selectedQuotes?.length > 0 &&
                    selectedQuotes.map(quote => {
                        // eslint-disable-next-line no-unused-expressions
                        return (
                            <div
                                key={quote.quoteId}
                                className="quote"
                                style={{
                                    padding: '1rem',
                                    border: '1px solid black',
                                    marginBottom: '1rem'
                                }}
                            >
                                <h4>{quote.author}</h4>
                                <hr />
                                <p>{quote.content}</p>
                                <hr />
                                <small>
                                    {' '}
                                    <b>Contributor:</b> {quote.owner}
                                </small>
                            </div>
                        );
                    })}
            </div>
            <ToastContainer />
        </div>
    );
}
