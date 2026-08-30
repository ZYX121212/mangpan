import type { Metadata } from "next";
import LegalPage from "../legal-page";

export const metadata: Metadata = {
  title: "Terms | Blind Chart",
  description: "Terms for using the Blind Chart trading decision game.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <section>
        <h2>Educational use only</h2>
        <p>
          Blind Chart is a decision-training game based on historical market data.
          It does not provide investment advice, recommendations, brokerage
          services, or assurances about future performance. Historical results do
          not predict future results.
        </p>
      </section>
      <section>
        <h2>Simulation limits</h2>
        <p>
          Prices, fees, slippage, liquidity, execution, scoring, and portfolio
          results are simplified simulation assumptions. They may differ from
          real trading and should not be used as the basis for an investment
          decision.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Do not manipulate scores, overload the service, or bypass controls.</li>
          <li>Do not submit unlawful, misleading, or impersonating player names.</li>
          <li>Do not copy or redistribute market data unless you have the rights.</li>
        </ul>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>
          The game is provided as available and may change, pause, reset scores,
          or remove abusive content. Features and historical datasets may be
          corrected or withdrawn without notice.
        </p>
      </section>
      <section>
        <h2>Your responsibility</h2>
        <p>
          You remain responsible for your financial decisions and for complying
          with laws that apply to you. Stop using the service if you do not agree
          with these terms.
        </p>
      </section>
    </LegalPage>
  );
}
