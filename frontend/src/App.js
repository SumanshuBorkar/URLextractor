import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!url || !query) {
      setError('Please enter both URL and query.');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const res = await axios.post('https://ur-lextractor-naxe.vercel.app/api/scrape', { url, query });
      const matches = res.data.results;
      console.log(matches, "this is the response")

      if (Array.isArray(matches) && matches.length > 0) {
        setResults(matches);
      } else {
        setError('No relevant results found.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch results. Please try again later.');
    }

    setLoading(false);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  };

  const getFullUrl = (path) => {
    try {
      const base = new URL(url);
      return new URL(path, base).href;
    } catch (e) {
      return url;
    }
  };

  return (
    <div className="App">
      <h1>Website Content Search</h1>

      <input
        type="text"
        placeholder="Enter website URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      <input
        type="text"
        placeholder="Enter search query"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>

      {error && <p className="error">{error}</p>}

      {Array.isArray(results) && results.length > 0 && (
        <div className="results">
          <h2>Search Results</h2>
          {results.map((match, idx) => (
            <div className="result-card" key={idx}>
              <p><strong>Text:</strong> {match.text}</p>

              <p>
                <strong>Score:</strong> <span style={{ color: 'green' }}>{match.score * 100} %</span>
              </p>

              <p>
                <strong>Tag:</strong> <code>{match.tag}</code>
              </p>

              <p>
                <strong>HTML Snippet:</strong>{' '}
                <span
                  dangerouslySetInnerHTML={{ __html: match.html }}
                  style={{ backgroundColor: '#f5f5f5', padding: '4px' }}
                />
              </p>

              <p>
                <strong>Path:</strong>{' '}
                <a href={getFullUrl(match.path)} target="_blank" rel="noopener noreferrer">
                  {match.path}
                </a>
              </p>

              <button onClick={() => handleCopy(match.text)}>Copy Text</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
