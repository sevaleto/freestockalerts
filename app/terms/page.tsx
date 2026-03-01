import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo />
        <Link href="/" className="text-sm text-text-secondary">
          ← Back to home
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 pb-20">
        <h1 className="text-3xl font-semibold text-text-primary">Terms of Use</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Last updated: February 28, 2026
        </p>
        
        <div className="prose prose-gray mt-8 max-w-none">
          <p>
            Wealthpire, Inc. d/b/a FreeStockAlerts.AI (&quot;Company,&quot; &quot;we,&quot; or &quot;us&quot;), provides its website (together with all other websites and services operated by or on behalf of Wealthpire, Inc. and its affiliates, the &quot;Site&quot;) to you, an individual user (&quot;you&quot;) for your individual usage, subject to compliance with the terms and conditions set forth herein.
          </p>
          
          <p className="font-semibold">
            Please read carefully, and note our MANDATORY ARBITRATION PROVISION and WAIVER OF CLASS ACTION PROVISION.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">1. Agreement</h2>
          <p>
            By using the Site, you agree to be bound by our Terms of Use (the &quot;TOU&quot;). If you do not agree to the terms and conditions contained in the TOU please do not access or otherwise use the Site or any information contained herein, and you understand that you are prohibited from accessing websites, blogs, or forums provided by FreeStockAlerts.AI or its affiliates.
          </p>
          <p>
            Please also read the <Link href="/privacy" className="text-primary underline">Privacy Policy</Link> carefully to understand how Company collects, uses and discloses personally identifiable information from its users. The Privacy Policy is hereby incorporated by reference as part of these Terms of Use.
          </p>
          <p>
            You affirm that you are over the age of 18, as the Site is not intended for children under 18. If it comes to FreeStockAlerts.AI attention through reliable means that a registered user is a child under 18 years of age, FreeStockAlerts.AI will cancel that user&apos;s account.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">2. Changes to the TOU</h2>
          <p>We reserve the right at any time to:</p>
          <ul>
            <li>Change the terms and conditions of the TOU;</li>
            <li>Change the Site, including eliminating or discontinuing any content or feature of the Site; or</li>
            <li>Impose fees, charges or other conditions for use of the Site or parts thereof (with reasonable notice).</li>
          </ul>
          <p>
            FreeStockAlerts.AI may modify the Site at any time without prior notice, and you accept those modifications if you continue to use the Site. You should check the Site frequently to see recent changes.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">3. Important Securities Disclaimer</h2>
          <p>
            You understand that no content published on the Site constitutes a recommendation that any particular security, portfolio of securities, transaction or investment strategy is suitable for any specific person. You further understand that none of the bloggers, information providers, or their affiliates are advising you personally concerning the nature, potential, value or suitability of any particular security, portfolio of securities, transaction, investment strategy or other matter.
          </p>
          <p>
            To the extent that any of the content published on the Site may be deemed to be investment advice or recommendations in connection with a particular security, such information is impersonal and not tailored to the investment needs of any specific person.
          </p>
          <p>
            You understand that an investment in any security is subject to a number of risks, and that discussions of any security published on the Site will not contain a list or description of relevant risk factors.
          </p>
          <p>
            In addition, please note that some of the stocks about which content is published on the Site have a low market capitalization and/or insufficient public float. Such stocks are subject to more risk than stocks of larger companies, including greater volatility, lower liquidity and less publicly available information. Blogs, postings or content on the Site which may or may not be deemed by you to be recommendations may have an effect on their stock prices.
          </p>
          <p>
            You understand that the Site may contain opinions from time to time with regard to securities mentioned in other FreeStockAlerts.AI blogs or products, and that opinions in one blog or product may be different from those in another blog or product. You understand and agree that, although we require all employees to disclose every stock in which they, their immediate family, or any entity under their control, have a personal interest, if such stock is mentioned in a blog, post, or content which they write, non-employees, including outside bloggers or other content contributors or their affiliates may write about securities in which they or their firms have a position, and that they may trade for their own account, and that they may or may not be subject to a disclosure policy.
          </p>
          <p>
            While the Company will not engage in front-running or trading against its own recommendations, The Company and its managers and employees reserve the right to hold possession in certain securities featured in its communications. Such positions will be disclosed AND will not purchase or sell the security for at least two (2) market days after publication.
          </p>
          <p>
            In cases where FreeStockAlerts.AI becomes aware that one of its employees has violated his or her disclosure obligation, appropriate action will be taken. In addition, outside bloggers or content contributors may be subject to certain restrictions on trading for their own account. However, you understand and agree that at the time of any transaction that you make, one or more bloggers or content contributors or their affiliates may have a position in the securities written about. The content contributors, and/or affiliates may have terms and conditions or privacy policy(ies) in addition to FreeStockAlerts.AI TOU, and their individual policies should be should be followed.
          </p>
          <p>
            You understand that performance data is supplied by sources believed to be reliable, that the calculations herein are made using such data, and that such calculations are not guaranteed by these sources, the information providers, or any other person or entity, and may not be complete.
          </p>
          <p>
            From time to time, reference may be made on our Site to prior articles and opinions we have published. These references may be selective, may reference only a portion of an article or opinion, and are likely not to be current. As markets change continuously, previously published information and data may not be current and should not be relied upon.
          </p>
          <p>
            All content on the Site is presented only as of the date published or indicated, and may be superseded by subsequent market events or for other reasons. In addition, you are responsible for setting the cache settings on your browser to ensure you are receiving the most recent data.
          </p>
          <p>
            <strong>Forward-Looking Statement.</strong> As defined in the United States Securities Act of 1933 Section 27(a), as amended in the Securities Exchange Act of 1934 Section 21(e), statements in this communication which are not purely historical are forward-looking statements and include statements regarding beliefs, plans, intent, predictions or other statements of future tense.
          </p>
          <p>
            <strong>Past Performance is Not Indicative of Future Results.</strong> Investing is inherently risky. While a potential for rewards exists, by investing, you are putting yourself at risk. You must be aware of the risks and be willing to accept them in order to invest in any type of security. Don&apos;t trade with money you can&apos;t afford to lose. This is neither a solicitation nor an offer to Buy/Sell securities. No representation is being made that any account will or is likely to achieve profits or losses similar to those discussed on this Site. The past performance of any trading system or methodology is not necessarily indicative of future results.
          </p>
          <p>
            <strong>CFTC RULE 4.41 – HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS HAVE CERTAIN LIMITATIONS.</strong> UNLIKE AN ACTUAL PERFORMANCE RECORD, SIMULATED RESULTS DO NOT REPRESENT ACTUAL TRADING. ALSO, SINCE THE TRADES HAVE NOT BEEN EXECUTED, THE RESULTS MAY HAVE UNDER-OR-OVER COMPENSATED FOR THE IMPACT, IF ANY, OF CERTAIN MARKET FACTORS, SUCH AS LACK OF LIQUIDITY. SIMULATED TRADING PROGRAMS IN GENERAL ARE ALSO SUBJECT TO THE FACT THAT THEY ARE DESIGNED WITH THE BENEFIT OF HINDSIGHT. NO REPRESENTATION IS BEING MADE THAT ANY ACCOUNT WILL OR IS LIKELY TO ACHIEVE PROFIT OR LOSSES SIMILAR TO THOSE SHOWN.
          </p>
          <p>
            All trades, patterns, charts, systems, etc., discussed in this message and the product materials are for illustrative purposes only and not to be construed as specific advisory recommendations. All ideas and material presented are entirely those of the author and do not necessarily reflect those of the publisher. No system or methodology has ever been developed that can guarantee profits or ensure freedom from losses. No representation or implication is being made that using the methodology or system will generate profits or ensure freedom from losses. The testimonials and examples used herein are exceptional results, which do not apply to the average member, and are not intended to represent or guarantee that anyone will achieve the same or similar results.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">4. No Investment Recommendations or Professional Advice</h2>
          <p>
            The Site is not intended to provide tax, legal, insurance or investment advice, and nothing on the Site should be construed as an offer to sell, a solicitation of an offer to buy, or a recommendation for any security by FreeStockAlerts.AI or any third party. You alone are solely responsible for determining whether any investment, security or strategy, or any other product or service, is appropriate or suitable for you based on your investment objectives and personal and financial situation. You should consult an attorney or tax professional regarding your specific legal or tax situation.
          </p>
          <p>
            The U.S. Securities and Exchange Commission has published information on various types of Cyberfraud. FINRA has provided insights into how to invest carefully and NASAA also provides tips on how not to avoid online investment schemes. The SEC, FINRA and the NASAA maintain outstanding websites at http://www.sec.gov and http://www.finra.org, and http://www.nasaa.org respectively.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">5. Copyright, Linking Policy and Trademarks</h2>
          <p>
            The Site and the content contained herein, as well as all copyrights, including without limitation, the text, documents, articles, products, software, graphics, photos, sounds, videos, interactive features, services, links, User Submissions (as defined below), third-party Apps, and any other content on the Site (&quot;Content&quot;) and the trademarks, service marks and logos contained therein are the property of FreeStockAlerts.AI and its third-party licensors or providers. You may access and use the Content, and download and/or print out copies of any content from the Site, solely for your personal, non-commercial use. If you download or print a copy of the Content for personal use, you must retain all copyright and other proprietary notices contained therein. You acknowledge that you do not acquire any ownership rights by using the Site. FreeStockAlerts.AI reserves all rights not expressly granted in and to the Site.
          </p>
          <p>
            The Site contains links to other Internet websites or links to Content created by third parties which is published on the Site. We neither control nor endorse such other websites or Content, nor have we reviewed or approved any Content that appears on such other websites or on our Site. Please read the terms of use and privacy policy of any such third party sites that you interact with before you engage in any activity. You are solely responsible and liable for your use of and linking to all third party sites. You acknowledge and agree that we shall not be held responsible for the legality, accuracy, or appropriateness of any Content, advertising, products, services, or information located on our Site or any other websites, nor for any loss or damages caused or alleged to have been caused by the use of or reliance on any such content. Similarly, while we do endeavor to facilitate the provision of quality Apps, we are not responsible for any loss or damages caused or alleged to have been caused by their use.
          </p>
          <p>
            You may link to any content on the Site. If you are interested in reprinting, republishing or distributing content from FreeStockAlerts.AI, please contact FreeStockAlerts.AI to obtain written consent. All trademarks, service marks, and logos used on our Sites are the trademarks, service marks, or logos of their respective owners.
          </p>
          <p>
            This section shall survive any termination of these TOU.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">6. User Conduct</h2>
          <p>
            You may not use, copy, display, sell, license, de-compile, republish, upload, post, transmit, distribute, create derivative works or otherwise exploit Content from the Site to online bulletin boards, message boards, newsgroups, chat rooms, or in other any manner, without our prior written permission in advance of such use. Modification of the Content or use of the Content for any purpose other than your own personal, noncommercial use is a violation of our copyright and other proprietary rights, and can subject you to legal liability.
          </p>
          <p>
            In addition, in connection with your use of the Site and its services (including by sending private messages to other registered users of the Site), you agree not to:
          </p>
          <ul>
            <li>Restrict or inhibit any other visitor from using the Site, including, without limitation, by means of &quot;hacking&quot; or defacing any portion of the Site;</li>
            <li>Use the Site for any unlawful purpose;</li>
            <li>Express or imply that any statements you make are endorsed by us, without our prior written consent;</li>
            <li>Modify, adapt, sublicense, translate, sell, reverse engineer, decompile or disassemble any portion of the Site;</li>
            <li>&quot;Frame&quot; or &quot;mirror&quot; any part of the Site without our prior written authorization;</li>
            <li>Use any robot, spider, site search/retrieval application, or other manual or automatic device or process to download, retrieve, index, &quot;data mine&quot;, &quot;scrape&quot;, &quot;harvest&quot; or in any way reproduce or circumvent the navigational structure or presentation of the Site or its contents;</li>
            <li>Harvest or collect information about visitors to the Site without their express consent;</li>
            <li>Send unsolicited or unauthorized advertisements, spam, chain letters, etc to other users of the Site;</li>
            <li>Transmit any Content which contains software viruses, or other harmful computer code, files or programs.</li>
          </ul>
          <p>
            You also agree to comply with all applicable laws, rules and regulations in connection with your use of the Site and the content made available therein.
          </p>
          <p>
            In order to access some of the services of the Site, you will have to create an account. By creating this account you agree to the following:
          </p>
          <ul>
            <li>You may only maintain a single account;</li>
            <li>You may never share your account user name or password or knowingly provide or authorize access to your account;</li>
            <li>You may never use another user&apos;s account without permission;</li>
            <li>When creating your account, you must provide accurate and complete information;</li>
            <li>You are solely responsible for the activity that occurs on your account, and you must keep your account password secure;</li>
            <li>You must notify us immediately of any breach of security or unauthorized use of your account;</li>
          </ul>
          <p>
            You will be liable for any use made of your account or password and the losses of FreeStockAlerts.AI or others due to such unauthorized use. We will not be liable for your losses caused by any unauthorized use of your account.
          </p>
          <p>
            FreeStockAlerts.AI has sole discretion, the right to refuse service or terminate your access to the Site, for any reason.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">7. Overview of Posting Content; Monitoring Content</h2>
          <p>
            The Site permits the submission of Content by users of the Site, including without limitation comments, articles, links, private messages sent to other registered users through the Site&apos;s messaging system, and including from those who give permission to FreeStockAlerts.AI to post their Content (&quot;User Submissions&quot;) and the hosting, sharing and publishing of such User Submissions on the Site. FreeStockAlerts.AI has sole discretion and without further notice to you, to monitor, censor, edit, move, delete, and/or remove any and all Content posted on its Site or any Content transmitted by direct messaging or by any other method to or from your FreeStockAlerts.AI user account at any time and for any reason. Without limiting the foregoing, FreeStockAlerts.AI has the right to delete any comment or Content that it believes, in its sole discretion, does or may violate the TOU of the Site by you.
          </p>
          <p>
            FreeStockAlerts.AI will not allow online harassment of any sort, by using any services on the Site you agree to not post any information used to harass or intimidate others including but not limited to:
          </p>
          <ul>
            <li>No incitement to hatred. Material that promotes hatred toward groups based on race or ethnic origin, religion, disability, gender, age, veteran status, or sexual orientation/gender identity will be removed.</li>
            <li>No pornography or pedophilia</li>
            <li>No direct or veiled threats against any person or group of people.</li>
            <li>No copyright infringement</li>
            <li>No plagiarism. This includes posting content verbatim from other sources without proper attribution and/or repurposing content from other sources and presenting it without reference to the content&apos;s creator.</li>
            <li>No publishing of other people&apos;s private and confidential information, such as credit card numbers, Social Security Numbers, and driver&apos;s and other license numbers.</li>
            <li>No impersonation of others in a manner that is intended to or does mislead or confuse others.</li>
            <li>No use for unlawful purposes or for promotion of dangerous and illegal activities. Your account may be terminated and you may be reported to the appropriate authorities.</li>
            <li>No spamming, link-spamming or transmitting malware and viruses.</li>
            <li>No personal attacks.</li>
            <li>No profanity or vulgarity.</li>
            <li>No business solicitations or advertising.</li>
            <li>No inappropriate, unethical or misleading behavior.</li>
          </ul>
          <p>
            FreeStockAlerts.AI encourages civil, thought-provoking debate and idea-sharing among investors and stock-market followers. In order to maintain a level of discourse appropriate to our user base, we are strongly opposed to trolling, uncivilized discussion, mudslinging, inappropriate language, and blanket dismissal of others&apos; ideas. At our discretion, we may delete comments, and block/delete accounts of users we believe lower the level of discourse and courtesy we strive to engender.
          </p>
          <p>
            Moderating decisions are subjective, and we strive to make them carefully and consistently. Due to the volume of content, we cannot review moderation decisions with users and will not reverse decisions.
          </p>
          <p>
            Our blogs and Content are intended to serve as a discussion center for thoughtful users who make their own investment decisions, with or without the help of a broker. They are not the place for stock touters, cheerleaders or hypesters. We strongly encourage all participants to disclose any positions they have in stocks being discussed, however due to the volume of content, we do not verify users positions in stock holdings.
          </p>
          <p>
            Without derogating from the above, FreeStockAlerts.AI, at their discretion, may refrain from posting or remove User Submissions that violate these standards or which are otherwise inappropriate. These standards are designed to ensure that the dialogue on the Site is credible, responsible, intelligent and informative. We cannot guarantee that users will tell the truth, and we will not monitor the veracity of names and positions or the content of any posts. However, by setting out the above guidelines, we hope to raise the credibility of the discussion and foster a spirit of open, honest exchanges of information.
          </p>
          <p>
            If an author has a business relationship with a company named in an article that he or she has authored, that relationship must be fully and accurately disclosed.
          </p>
          <p>
            If you have any comments on our policies, or complaints or concerns of any kind about any posts, please contact us. We will review all of the information that you communicate to us, but we may not be able to take action or respond directly to each email.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">8. User Submissions; Online Rules of Conduct</h2>
          <p>
            When you post any User Submission on the Site or give FreeStockAlerts.AI permission to post your Content, you agree to:
          </p>
          <ul>
            <li>Post comments in both tone and content that contribute in a positive and high quality manner to the substantive exchange of information and the subject matter of the Site.</li>
            <li>Automatically grant FreeStockAlerts.AI a royalty-free, perpetual, worldwide, irrevocable, non-exclusive and fully transferable and sublicensable right and license to use, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, perform and display any User Submission (in whole or in part) and/or to incorporate any of your User Submission in other works now or in the future and in any media formats and through any media channels, and you confirm and warrant to FreeStockAlerts.AI that you own the copyright in each of your User Submissions and have all the rights, power and authority necessary to grant the above license and rights.</li>
          </ul>
          <p>
            FreeStockAlerts.AI will use commercially reasonable efforts to attribute material User Submissions to the author.
          </p>
          <p>
            When you post any User Submission on the Site, you also agree to abide by the following disclosure rules:
          </p>
          <ul>
            <li>To disclose the existence at the time of writing of a long or short position (including stocks, options or other instruments) in any stock mentioned in any User Submission (except for &quot;Comments&quot;).</li>
            <li>You may not write about a stock with the intention to boost or reduce the stock&apos;s price and sell (or buy) the stock into the resulting strength or weakness.</li>
            <li>If you intend at the time or writing to sell or buy a stock within three days of publication of a User Submission that discusses that stock, you must disclose this.</li>
            <li>You will disclose any material relationships with companies whose stocks you write about in a User Submission or parties that stand to gain in any way from the viewpoint you are outlining. Examples: You must disclose if you are employed by a company whose stock you are writing about; perform consulting for a company you write about; receive paid advertising revenue or any other form of sponsorship fee from a company you write about. This applies to narrow asset classes as well. For example, if you are paid to promote a rare metals dealer, that must be disclosed in any User Submission about rare metals.</li>
            <li>If you choose an alias, be responsible for all statements made and acts or omissions that occur by use of your alias.</li>
            <li>By posting user submissions, you agree to hold FreeStockAlerts.AI harmless in connection with any claims relating to any action taken by FreeStockAlerts.AI as part of its investigation of a suspected violation or result of its conclusion that a violation of these TOU has occurred, including but not limited to the removal of User Submission from the Site or a suspension or termination of your access to the Site, and any and all fees and costs associated with defending alleged breaches of any federal or local laws or administrative regulations.</li>
          </ul>
          <p>
            Maintain and promptly update your registration data to keep it true, accurate, current and complete.
          </p>
          <p>
            You agree to not:
          </p>
          <ul>
            <li>Choose an alias that is threatening, abusive, offensive, harassing, derisive, defamatory, vulgar, obscene, libelous, hatefully, racially, ethnically or otherwise or objectionable.</li>
            <li>Post or transmit any Content that you either know or should know is false, deceptive or misleading, or misrepresent or deceive others as to the source, accuracy, integrity or completeness of any comment you post.</li>
            <li>Post or transmit any Content that is unlawful, harmful or injurious to others, contains software viruses, or other harmful computer code, files or programs, threatening, abusive, offensive, harassing, derisive, defamatory, vulgar, obscene, libelous, hatefully, racially, ethnically or otherwise tortious or objectionable.</li>
            <li>Post or transmit any Content that does or may invade the privacy or violate or infringe on any rights of others, including, without limitation, copyrights and other intellectual property rights.</li>
            <li>By use of your alias or in any comment, impersonate any person or entity, falsely or deceptively state, infer or otherwise misrepresent your affiliation with or connection to any person or entity.</li>
            <li>Post or transmit any Content which, either the act of posting or the comment itself, you do not have a right to do under any law, regulation or order of any court, or as a result of an employment, contractual, fiduciary or other legal obligation or relationship.</li>
            <li>Post or transmit any advertising, promotional materials, so called &quot;chain letters,&quot; &quot;pyramid&quot; or other schemes or invitations to participate in these or any other form of solicitation or promotion.</li>
            <li>Post or transmit any non-public or otherwise restricted, confidential or proprietary information without authorization.</li>
            <li>Violate any local, state, national or international law, regulation or order of any court, including but not limited to regulations of the U.S. Securities and Exchange Commission, any rules of any securities exchange, including without limitation, the New York Stock Exchange, the American Stock Exchange or The Nasdaq Stock Market.</li>
          </ul>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">9. Disclosure</h2>
          <p>
            We reserve the right to access, read, preserve, and disclose any User Submissions (whether published or not) or any other information we believe is reasonably necessary to (a) comply with any applicable law, regulation, legal process, subpoena or governmental or regulatory request, (b) enforce these TOU, including investigation of potential violations of it, (c) detect, prevent, or otherwise address fraud, security or technical issues, (d) respond to user support requests, or (e) protect the rights, property or safety of FreeStockAlerts.AI, its users, yourself or the public.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">10. Disclaimer of Warranties</h2>
          <p>
            THE SITE, AND ANY PRODUCT OR SERVICE OBTAINED OR ACCESSED THROUGH THE SITE, IS PROVIDED &quot;AS IS&quot; AND WITHOUT REPRESENTATIONS OR WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, FREESTOCKALERTS.AI, ITS OFFICERS, DIRECTORS, EMPLOYEES, AFFILIATES, SUPPLIERS, ADVERTISERS, AND AGENTS DISCLAIM ALL WARRANTIES, EXPRESS, IMPLIED OR STATUTORY, INCLUDING, BUT NOT LIMITED TO, WARRANTIES OF TITLE AND NON-INFRINGEMENT, IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, AND ALL WARRANTIES RELATING TO THE ADEQUACY, ACCURACY OR COMPLETENESS OF ANY INFORMATION ON OUR SITE.
          </p>
          <p>
            Some jurisdictions do not allow the exclusion of implied warranties, so the above exclusions may not apply to you.
          </p>
          <p>
            FREESTOCKALERTS.AI AND ITS AFFILIATES, SUPPLIERS, AGENTS AND SPONSORS DO NOT WARRANT THAT YOUR USE OF THE SITE WILL BE UNINTERRUPTED, ERROR-FREE OR SECURE, OR THAT THE SITE OR THE SERVER(S) ON WHICH THE SITE IS HOSTED ARE FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. YOU ASSUME TOTAL RESPONSIBILITY AND RISK FOR YOUR USE OF THE SITE AND YOUR RELIANCE THEREON. NO OPINION, ADVICE, OR STATEMENT OF FREESTOCKALERTS.AI OR ITS AFFILIATES, SUPPLIERS, AGENTS, MEMBERS, OR VISITORS, WHETHER MADE ON THE SITE OR OTHERWISE, SHALL CREATE ANY WARRANTY.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">11. Limitation of Liability</h2>
          <p>
            NEITHER FREESTOCKALERTS.AI NOR ITS AFFILIATES AND THEIR RESPECTIVE OFFICERS, DIRECTORS, EMPLOYEES, SUPPLIERS, ADVERTISERS, AGENTS AND SPONSORS ARE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, EXEMPLARY, PUNITIVE OR OTHER DAMAGES UNDER ANY CONTRACT, NEGLIGENCE, STRICT LIABILITY OR OTHER THEORY ARISING OUT OF OR RELATING IN ANY WAY TO THE SITE AND/OR ANY CONTENT CONTAINED THEREIN, OR ANY PRODUCT OR SERVICE USED OR PURCHASED THROUGH FREESTOCKALERTS.AI. YOUR SOLE REMEDY FOR DISSATISFACTION WITH THE SITE IS TO STOP USING IT. THE SOLE AND EXCLUSIVE MAXIMUM LIABILITY TO FREESTOCKALERTS.AI FOR ALL DAMAGES, LOSSES, AND CAUSES OF ACTION (WHETHER IN CONTRACT, TORT (INCLUDING, WITHOUT LIMITATION, NEGLIGENCE), OR OTHERWISE) SHALL NOT EXCEED THE TOTAL AMOUNT PAID TO US BY YOU, IF ANY, FOR ACCESS TO THE SITE OR ANY SERVICES, DURING THE PREVIOUS SIX (6) MONTHS PRIOR TO BRINGING THE CLAIM.
          </p>
          <p>
            Some jurisdictions do not allow the limitation or exclusion of liability for incidental or consequential damages, so the above limitations may not apply to you.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">12. Indemnification</h2>
          <p>
            As a condition of your use of the Site, you agree to indemnify, defend and hold us, our officers, directors, employees, agents and representatives harmless from and against any and all claims, damages, losses, costs (including reasonable attorneys&apos; fees), or other expenses that arise directly or indirectly out of or from (a) your violation of the TOU; (b) your use of the Site; (c) your violation of the rights of any third party, or (d) any claim that one of Your User Submissions caused damage to a third party. This defense and indemnification obligation will survive these TOU and your use of the Site.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">13. Termination</h2>
          <p>
            You understand and agree that FreeStockAlerts.AI may, under certain circumstances and without prior notice to you, terminate your access to and use of the Site. Cause for such termination shall include, but not be limited to, (i) breaches or violations of the TOU or other agreements or guidelines, (ii) requests by law enforcement or other government or regulatory authorities or (iii) repeat violators of third party copyrights or other intellectual property.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">14. Copyright Policy</h2>
          <p>
            FreeStockAlerts.AI respects the intellectual property of others, and we ask our users to do the same. FreeStockAlerts.AI may, in appropriate circumstances and at its sole discretion, terminate the account or access of users who infringe the intellectual property rights of others.
          </p>
          <p>
            If you believe that your work has been copied in a way that constitutes copyright infringement, please provide the following information:
          </p>
          <ul>
            <li>an electronic or physical signature of the person authorized to act on behalf of the owner of the copyright interest;</li>
            <li>a description of the copyrighted work that you claim has been infringed, including the URL (web page address) of the location where the copyrighted work exists or a copy of the copyrighted work;</li>
            <li>a description of where the material that you claim is infringing is located on the site, including the URL;</li>
            <li>your address, telephone number, and email address;</li>
            <li>a statement by you that you have a good faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law; and</li>
            <li>a statement by you, made under penalty of perjury, that the above information in your Notice is accurate and that you are the copyright owner or authorized to act on the copyright owner&apos;s behalf.</li>
          </ul>
          <p>
            Please also note that under Section 512(f) any person who knowingly materially misrepresents that material or activity is infringing may be subject to liability.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">15. Miscellaneous</h2>
          <p>
            The Site is directed solely to individuals residing in jurisdictions in which provision of the Site&apos;s content is legal. We make no representation that materials provided on the Site are appropriate or available for use in other locations. Those who choose to access the Site from other locations do so on their own initiative and at their own risk, and are responsible for compliance with local laws, if and to the extent applicable. We reserve the right to limit the availability of the Site to any person, geographic area, or jurisdiction we so desire, at any time and in our sole discretion, and to limit the quantities of any such service or product that we provide.
          </p>
          <p>
            The TOU, together with all policies referred to herein, constitutes the entire agreement relating to your use of the Site and supersedes and any all prior or contemporaneous written or oral agreements on that subject between us. The TOU, privacy policy and the relationship between you and FreeStockAlerts.AI are governed by and construed in accordance with the laws of the State of California, without regard to its principles of conflict of laws. You and FreeStockAlerts.AI agree to submit to the personal and exclusive jurisdiction of the federal and state courts located within California, and waive any jurisdictional, venue, or inconvenient forum objections to such courts. If any provision of the TOU is found to be unlawful, void, or for any reason unenforceable, then that provision shall be deemed severable from the TOU and shall not affect the validity and enforceability of any remaining provisions. No waiver by either party of any breach or default hereunder shall be deemed to be a waiver of any preceding or subsequent breach or default. Any heading, caption or section title contained in the TOU is inserted only as a matter of convenience and in no way defines or explains any section or provision hereof.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">16. GOVERNING LAW AND JURISDICTION</h2>
          <p>
            These Terms and Conditions shall be governed by and construed in accordance with the laws of the State of California. You hereby consent to binding arbitration in the State of California to resolve any disputes arising under this Terms and Conditions.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">17. ARBITRATION OF DISPUTES</h2>
          <p>
            Except for payment/collection issues or infringement of Company&apos;s intellectual property, which can be heard by a court of competent jurisdiction, the parties agree that any dispute or claim in law or equity arising between them regarding the use of this Site or these Terms of Use, including any dispute regarding the enforceability or applicability of this arbitration provision, shall be decided by neutral, binding arbitration conducted in Los Angeles County, California. The arbitrator shall be a retired judge, justice, or an attorney with at least ten (10) years of legal experience relating to the subject matter of this Agreement, unless the parties mutually agree otherwise, who shall render an award in accordance with the substantive laws of Los Angeles County, California. In all other respects, the arbitration shall be conducted in accordance with the rules and procedures of the American Arbitration Association, subject to the parties being allowed limited discovery. Judgment upon the award of the arbitrator(s) may be entered in any court having jurisdiction.
          </p>
          <p>
            <strong>NOTICE:</strong> BY USING THIS SITE YOU ARE AGREEING TO HAVE ANY DISPUTE ARISING OUT OF THE MATTERS INCLUDED IN THIS &quot;ARBITRATION OF DISPUTES&quot; PROVISION DECIDED BY NEUTRAL ARBITRATION AND YOU ARE GIVING UP ANY RIGHTS YOU MIGHT POSSESS TO HAVE THE DISPUTE LITIGATED IN A COURT OR JURY TRIAL. YOU ARE GIVING UP YOUR JUDICIAL RIGHTS TO DISCOVERY AND APPEAL, UNLESS THOSE RIGHTS ARE SPECIFICALLY INCLUDED IN THE &quot;ARBITRATION OF DISPUTES&quot; PROVISION. IF YOU REFUSE TO SUBMIT TO ARBITRATION AFTER AGREEING TO THIS PROVISION YOU MAY BE COMPELLED TO ARBITRATE ANYHOW PURSUANT TO A COURT ORDER. YOUR AGREEMENT TO THIS ARBITRATION PROVISION IS VOLUNTARY. IF YOU DO NOT WISH TO AGREE TO ARBITRATION, THEN YOU MAY NOT USE THIS SITE.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">18. CLASS ACTION WAIVER</h2>
          <p>
            ARBITRATION OR ANY OTHER LEGAL ACTION ARISING IN CONNECTION WITH THE USE OF THIS SITE, THE SERVICES OFFERED THROUGH THIS SITE, OR THESE TERMS OF USE MUST BE ON AN INDIVIDUAL BASIS, WHERE ALLOWED BY APPLICABLE LAWS. THIS MEANS NEITHER YOU NOR COMPANY MAY JOIN OR CONSOLIDATE CLAIMS BY OR AGAINST OTHER CUSTOMERS, OR LITIGATE IN COURT OR ARBITRATE ANY CLAIMS AS A REPRESENTATIVE OR MEMBER OF A CLASS OR IN A PRIVATE ATTORNEY GENERAL CAPACITY.
          </p>

          <h2 className="text-xl font-semibold text-text-primary mt-8 mb-4">19. ATTORNEYS&apos; FEES</h2>
          <p>
            In any dispute, action, proceeding, or arbitration regarding the use of this Site or these Terms Of Use, including the enforcement of any arbitration provision herein, the party prevailing in such action or proceeding shall be entitled to recover, in addition to any other award of damages or other remedies, its reasonable attorneys&apos; and experts&apos; fees, costs and expenses (including, without limitation, expenses for expert witnesses and all reasonable attorneys&apos; fees, costs and expenses upon appeal).
          </p>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-text-secondary">
              For questions about these Terms of Use, please contact us at <a href="mailto:support@freestockalerts.ai" className="text-primary underline">support@freestockalerts.ai</a>.
            </p>
            <p className="text-sm text-text-secondary mt-2">
              © 2026 Wealthpire, Inc. All Rights Reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}