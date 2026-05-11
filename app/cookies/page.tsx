
import { NextPage } from 'next';

const CookieNoticePage: NextPage = () => {
  const lastUpdated = '2024-08-02';

  return (
    <div className="prose prose-lg mx-auto p-8">
      <h1>Cookie Notice</h1>
      <p className="text-gray-500">Last Updated: {lastUpdated}</p>
      <p className="lead">
        This Cookie Notice explains how URAI (&quot;we&quot;, &quot;us&quot;, and &quot;our&quot;) uses cookies and similar technologies
        to recognize you when you visit our website. It explains what these technologies are and why we use them,
        as well as your rights to control our use of them.
      </p>

      <nav>
        <h2>On this page</h2>
        <ul>
          <li><a href="#what-are-cookies">What Are Cookies?</a></li>
          <li><a href="#why-we-use-cookies">Why We Use Cookies</a></li>
          <li><a href="#cookie-categories">Categories of Cookies We Use</a></li>
          <li><a href="#how-to-control">How You Can Control Cookies</a></li>
        </ul>
      </nav>

      <section id="what-are-cookies">
        <h2>What Are Cookies?</h2>
        <p>
          Cookies are small data files that are placed on your computer or mobile device when you visit a website.
          Cookies are widely used by website owners in order to make their websites work, or to work more
          efficiently, as well as to provide reporting information.
        </p>
      </section>

      <section id="why-we-use-cookies">
        <h2>Why We Use Cookies</h2>
        <p>
          We use cookies for several reasons. Some cookies are required for technical reasons in order for our
          website to operate, and we refer to these as "essential" or "strictly necessary" cookies. Other cookies
          enable us to track and target the interests of our users to enhance the experience on our properties.
        </p>
      </section>

      <section id="cookie-categories">
        <h2>Categories of Cookies We Use</h2>
        <p>Our use of cookies is minimal and focused on core functionality and security.</p>
        <div className="space-y-4">
            <div className="p-4 border rounded-md">
                <h3><strong>Strictly Necessary Cookies</strong></h3>
                <p>
                    These cookies are essential to provide you with services available through our website and to use
                    some of its features, such as access to secure areas. Because these cookies are strictly necessary
                    to deliver the website, you cannot refuse them without impacting how our services function.
                </p>
            </div>
            <div className="p-4 border rounded-md">
                <h3><strong>Performance and Analytics Cookies</strong></h3>
                <p>
                   We use a very limited set of analytics cookies to collect information about how our privacy center is used.
                   This helps us understand what content is most useful and to improve the site. The information collected
                   is aggregated and anonymous and is not used to track you.
                </p>
            </div>
        </div>
      </section>

      <section id="how-to-control">
        <h2>How You Can Control Cookies</h2>
        <p>
          You have the right to decide whether to accept or reject cookies. You can exercise your cookie preferences
          by setting or amending your web browser controls. If you choose to reject cookies, you may still use our
          website though your access to some functionality may be restricted.
        </p>
        <p>
            As our use of cookies is minimal, we do not currently display a cookie banner for managing non-essential
            cookies. Should we introduce cookies for advertising or more detailed tracking in the future, we will
            implement a consent tool to give you granular control.
        </p>
      </section>
    </div>
  );
};

export default CookieNoticePage;
