import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container mx-auto p-6">
        <h1 className="font-zaloga text-2xl font-bold">DR-YP Vendor Hub</h1>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="font-zaloga text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            Streamline Your Storefront
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg leading-8 text-gray-600">
            The all-in-one platform to upload products, manage inventory, and track your sales with ease. Focus on what you do best, we&apos;ll handle the rest.
          </p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Get Started
            </Link>
          </div>
        </div>
      </main>
      <footer className="container mx-auto p-6 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} DR-YP. All rights reserved.</p>
      </footer>
    </div>
  );
}
