import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo />
        <Link href="/" className="text-sm text-text-secondary">
          ← Back to home
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 pb-20">
        <h1 className="text-3xl font-semibold text-text-primary">Disclaimer</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Last updated: February 28, 2026
        </p>

        <div className="prose prose-gray mt-8 max-w-none">
          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">Important Securities Disclaimer</h2>
          <p>
            FreeStockAlerts.AI is a service operated by Wealthpire, Inc. The information provided on this website and through our alerts, emails, and other communications is for informational and educational purposes only. Nothing on this site constitutes a recommendation that any particular security, portfolio of securities, transaction, or investment strategy is suitable for any specific person.
          </p>
          <p>
            None of the information providers, bloggers, contributors, or their affiliates are advising you personally concerning the nature, potential, value, or suitability of any particular security, portfolio of securities, transaction, investment strategy, or other matter.
          </p>
          <p>
            To the extent that any of the content published on this site may be deemed to be investment advice or recommendations in connection with a particular security, such information is impersonal and not tailored to the investment needs of any specific person.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">No Investment Recommendations or Professional Advice</h2>
          <p>
            This site is not intended to provide tax, legal, insurance, or investment advice, and nothing on this site should be construed as an offer to sell, a solicitation of an offer to buy, or a recommendation for any security by FreeStockAlerts.AI or any third party. You alone are solely responsible for determining whether any investment, security or strategy, or any other product or service, is appropriate or suitable for you based on your investment objectives and personal and financial situation. You should consult an attorney or tax professional regarding your specific legal or tax situation.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">Investment Risks</h2>
          <p>
            You understand that an investment in any security is subject to a number of risks, and that discussions of any security published on this site will not contain a list or description of all relevant risk factors.
          </p>
          <p>
            Some of the stocks discussed on this site may have a low market capitalization and/or insufficient public float. Such stocks are subject to more risk than stocks of larger companies, including greater volatility, lower liquidity, and less publicly available information.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">Disclosure of Interests</h2>
          <p>
            While the Company will not engage in front-running or trading against its own recommendations, the Company and its managers and employees reserve the right to hold positions in certain securities featured in its communications. Such positions will be disclosed and will not be purchased or sold for at least two (2) market days after publication.
          </p>
          <p>
            You understand and agree that at the time of any transaction that you make, one or more contributors or their affiliates may have a position in the securities written about. Content contributors and/or affiliates may have terms and conditions or privacy policies in addition to FreeStockAlerts.AI&apos;s Terms of Use.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">Performance Data</h2>
          <p>
            Performance data is supplied by sources believed to be reliable. Calculations are made using such data, and such calculations are not guaranteed by these sources, the information providers, or any other person or entity, and may not be complete.
          </p>
          <p>
            All content on this site is presented only as of the date published or indicated, and may be superseded by subsequent market events or for other reasons.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">Forward-Looking Statements</h2>
          <p>
            As defined in the United States Securities Act of 1933 Section 27(a), as amended in the Securities Exchange Act of 1934 Section 21(e), statements in our communications which are not purely historical are forward-looking statements and include statements regarding beliefs, plans, intent, predictions, or other statements of future tense.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">Past Performance</h2>
          <p>
            <strong>Past Performance is Not Indicative of Future Results.</strong> Investing is inherently risky. While a potential for rewards exists, by investing, you are putting yourself at risk. You must be aware of the risks and be willing to accept them in order to invest in any type of security. Don&apos;t trade with money you can&apos;t afford to lose. This is neither a solicitation nor an offer to Buy/Sell securities. No representation is being made that any account will or is likely to achieve profits or losses similar to those discussed on this site. The past performance of any trading system or methodology is not necessarily indicative of future results.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">CFTC Disclaimer</h2>
          <p className="uppercase">
            <strong>CFTC RULE 4.41 – HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS HAVE CERTAIN LIMITATIONS.</strong> UNLIKE AN ACTUAL PERFORMANCE RECORD, SIMULATED RESULTS DO NOT REPRESENT ACTUAL TRADING. ALSO, SINCE THE TRADES HAVE NOT BEEN EXECUTED, THE RESULTS MAY HAVE UNDER-OR-OVER COMPENSATED FOR THE IMPACT, IF ANY, OF CERTAIN MARKET FACTORS, SUCH AS LACK OF LIQUIDITY. SIMULATED TRADING PROGRAMS IN GENERAL ARE ALSO SUBJECT TO THE FACT THAT THEY ARE DESIGNED WITH THE BENEFIT OF HINDSIGHT. NO REPRESENTATION IS BEING MADE THAT ANY ACCOUNT WILL OR IS LIKELY TO ACHIEVE PROFIT OR LOSSES SIMILAR TO THOSE SHOWN.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">General Disclaimer</h2>
          <p>
            All trades, patterns, charts, systems, etc., discussed on this site and in product materials are for illustrative purposes only and not to be construed as specific advisory recommendations. All ideas and material presented are entirely those of the author and do not necessarily reflect those of the publisher. No system or methodology has ever been developed that can guarantee profits or ensure freedom from losses. No representation or implication is being made that using any methodology or system will generate profits or ensure freedom from losses.
          </p>
          <p>
            The testimonials and examples used herein are exceptional results, which do not apply to the average member, and are not intended to represent or guarantee that anyone will achieve the same or similar results.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">Regulatory Resources</h2>
          <p>
            The U.S. Securities and Exchange Commission has published information on various types of Cyberfraud. FINRA has provided insights into how to invest carefully and NASAA also provides tips on how to avoid online investment schemes. These organizations maintain helpful websites:
          </p>
          <ul>
            <li><a href="https://www.sec.gov" className="text-primary underline" target="_blank" rel="noopener noreferrer">SEC (www.sec.gov)</a></li>
            <li><a href="https://www.finra.org" className="text-primary underline" target="_blank" rel="noopener noreferrer">FINRA (www.finra.org)</a></li>
            <li><a href="https://www.nasaa.org" className="text-primary underline" target="_blank" rel="noopener noreferrer">NASAA (www.nasaa.org)</a></li>
          </ul>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">Additional Information</h2>
          <p>
            For the full terms governing your use of FreeStockAlerts.AI, please review our <Link href="/terms" className="text-primary underline">Terms of Use</Link> and <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
          </p>
          <p>
            If you have any questions about this Disclaimer, please contact us at <a href="mailto:support@freestockalerts.ai" className="text-primary underline">support@freestockalerts.ai</a>.
          </p>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-text-secondary">
              © 2026 Wealthpire, Inc. All Rights Reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
