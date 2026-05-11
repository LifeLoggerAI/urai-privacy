
export default function DataPage() {
  return (
    <div className="prose prose-sm md:prose-base max-w-4xl mx-auto">
      <h1>Data & Consent Overview</h1>
      <p className="text-sm text-gray-500">Last updated: October 26, 2023</p>

      <h2>What We Collect</h2>
      <p>
        We collect the following information:
        <ul>
          <li>Information you provide to us directly, such as your name and email address.</li>
          <li>Information we collect automatically, such as your IP address and browser type.</li>
        </ul>
      </p>

      <h2>Opt-In Model</h2>
      <p>
        We use an opt-in model for data collection. This means that we will not collect any information from you unless you explicitly consent to it. By default, analytics and other non-essential data collection are turned off.
      </p>

      <h2>User Controls</h2>
      <p>
        You can manage your data and consent settings at any time. You can also request that we delete your data at any time.
      </p>

      <h2>Consent Tiers</h2>
      <p>
        We offer different consent tiers, so you can choose how much information you want to share with us.
      </p>
    </div>
  )
}
