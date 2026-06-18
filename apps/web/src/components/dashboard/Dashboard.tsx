import AccountsSummary from './AccountsSummary';
import ExchangeRates from './ExchangeRates';

export default function Dashboard() {
  return (
    <div className={'p-6'}>
      <ExchangeRates />
      <h1 className={'text-2xl font-bold mb-6 mt-4'}>{'Dashboard'}</h1>
      <div className={'grid grid-cols-1 md:grid-cols-2 gap-6'}>
        <AccountsSummary />
      </div>
    </div>
  );
}
