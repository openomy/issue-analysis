export default function TestPage() {
  return (
    <div className="min-h-screen bg-blue-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-900 mb-4">
          Tailwind CSS Test Page
        </h1>
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <p className="text-gray-700 mb-4">
            If you can see this styled properly, Tailwind CSS is working.
          </p>
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Test Button
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-100 p-4 rounded">
            <h3 className="font-semibold text-green-800">Success</h3>
            <p className="text-green-600">Tailwind classes are working</p>
          </div>
          <div className="bg-red-100 p-4 rounded">
            <h3 className="font-semibold text-red-800">Error</h3>
            <p className="text-red-600">If unstyled, Tailwind has issues</p>
          </div>
        </div>
      </div>
    </div>
  )
}