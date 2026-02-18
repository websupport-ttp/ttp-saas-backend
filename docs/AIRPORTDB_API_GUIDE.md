# AirportDB API Integration Guide

## Overview

The AirportDB API integration provides fast, cached airport data specifically optimized for autocomplete functionality in travel applications. It uses the AirportDB.io service as the primary data source with intelligent caching and search algorithms.

## API Token

**Token:** `f4068f4a77de13bc33a1e10c2fc185a296c52d39c33a42bcee4bf3e07053ca867111f8bfeab20cbf4d865dff5f433bb1`

## Available Endpoints

### 1. Airport Search (Autocomplete)
**Endpoint:** `GET /api/v1/airportdb/search`

**Purpose:** Optimized for autocomplete functionality with intelligent ranking

**Parameters:**
- `q` (required): Search query (airport name, city, country, or airport code)
- `limit` (optional): Maximum results (1-50, default: 10)

**Example:**
```bash
GET /api/v1/airportdb/search?q=new%20york&limit=5
```

**Response:**
```json
{
  "success": true,
  "message": "Found 5 airports matching \"new york\"",
  "data": [
    {
      "iataCode": "JFK",
      "icaoCode": "KJFK",
      "name": "John F Kennedy International Airport",
      "city": "New York",
      "country": "United States",
      "countryCode": "US",
      "displayName": "John F Kennedy International Airport (JFK)",
      "fullDisplayName": "John F Kennedy International Airport, New York, United States (JFK)",
      "coordinates": {
        "latitude": 40.6413,
        "longitude": -73.7781
      }
    }
  ],
  "meta": {
    "query": "new york",
    "count": 5,
    "limit": 5,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Airport Details
**Endpoint:** `GET /api/v1/airportdb/airport/:code`

**Purpose:** Get detailed information about a specific airport

**Parameters:**
- `code` (path): IATA or ICAO airport code

**Example:**
```bash
GET /api/v1/airportdb/airport/JFK
```

### 3. Popular Airports
**Endpoint:** `GET /api/v1/airportdb/popular`

**Purpose:** Get list of popular airports (major hubs)

**Parameters:**
- `limit` (optional): Maximum results (1-100, default: 50)
- `country` (optional): ISO country code filter

**Example:**
```bash
GET /api/v1/airportdb/popular?limit=20&country=US
```

### 4. Countries
**Endpoint:** `GET /api/v1/airportdb/countries`

**Purpose:** Get list of all countries with airports

**Example:**
```bash
GET /api/v1/airportdb/countries
```

## Admin Endpoints (Require Authentication)

### 5. Cache Status
**Endpoint:** `GET /api/v1/airportdb/cache/status`

**Purpose:** Get current cache status and statistics

### 6. Clear Cache
**Endpoint:** `POST /api/v1/airportdb/cache/clear`

**Purpose:** Clear all cached data

### 7. Initialize Cache
**Endpoint:** `POST /api/v1/airportdb/cache/init`

**Purpose:** Manually initialize the airport cache

## Search Algorithm

The search functionality uses an intelligent ranking system:

1. **Exact IATA code match** (Score: 100) - Highest priority
2. **IATA code starts with query** (Score: 90)
3. **Airport name starts with query** (Score: 85)
4. **City name starts with query** (Score: 80)
5. **Country name starts with query** (Score: 75)
6. **Contains query in any field** (Score: 50-70) - Variable based on relevance

## Caching Strategy

- **Airport Data Cache:** 24 hours
- **Autocomplete Cache:** 1 hour per search query
- **Countries Cache:** 24 hours
- **Memory-based caching** for optimal performance

## Rate Limiting

- **Search endpoint:** 100 requests/minute
- **General endpoints:** 30 requests/minute
- **Admin endpoints:** 10 requests/5 minutes

## Frontend Integration

### React/TypeScript Example

```typescript
// Airport search hook
const useAirportSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchAirports = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/airportdb/search?q=${encodeURIComponent(searchQuery)}&limit=10`
        );
        const data = await response.json();
        setResults(data.data || []);
      } catch (error) {
        console.error('Airport search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    searchAirports(query);
  }, [query, searchAirports]);

  return { query, setQuery, results, loading };
};

// Autocomplete component
const AirportAutocomplete = ({ onSelect, placeholder = "Search airports..." }) => {
  const { query, setQuery, results, loading } = useAirportSearch();

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full p-3 border rounded-lg"
      />
      
      {query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-50">
          {loading && (
            <div className="p-3 text-gray-500">Searching...</div>
          )}
          
          {!loading && results.length === 0 && (
            <div className="p-3 text-gray-500">No airports found</div>
          )}
          
          {!loading && results.map((airport) => (
            <button
              key={airport.iataCode}
              onClick={() => onSelect(airport)}
              className="w-full p-3 text-left hover:bg-gray-100 border-b last:border-b-0"
            >
              <div className="font-medium">{airport.displayName}</div>
              <div className="text-sm text-gray-500">
                {airport.city}, {airport.country}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

## Testing

### Run Tests
```bash
# Test all endpoints
node backend/test-airportdb-api.js

# Initialize cache
node backend/scripts/init-airportdb.js
```

### Manual Testing
```bash
# Search airports
curl "http://localhost:3000/api/v1/airportdb/search?q=london&limit=5"

# Get airport details
curl "http://localhost:3000/api/v1/airportdb/airport/LHR"

# Get popular airports
curl "http://localhost:3000/api/v1/airportdb/popular?limit=10"

# Get countries
curl "http://localhost:3000/api/v1/airportdb/countries"
```

## Performance Considerations

1. **First Request:** May take 2-3 seconds to load all airports from AirportDB
2. **Subsequent Requests:** < 10ms average response time
3. **Memory Usage:** ~50MB for full airport dataset
4. **Autocomplete Cache:** Keeps last 100 search queries cached

## Error Handling

The API includes comprehensive error handling:

- **400 Bad Request:** Invalid parameters
- **401 Unauthorized:** Missing/invalid authentication (admin endpoints)
- **403 Forbidden:** Insufficient permissions
- **404 Not Found:** Airport not found
- **429 Too Many Requests:** Rate limit exceeded
- **500 Internal Server Error:** Server/API errors
- **502 Bad Gateway:** AirportDB API issues
- **503 Service Unavailable:** AirportDB API unavailable

## Migration from Existing Reference Data

To migrate from the existing reference data endpoints:

1. **Replace search calls:**
   - Old: `/api/v1/reference/airports/search?query=london`
   - New: `/api/v1/airportdb/search?q=london`

2. **Update response handling:**
   - New format includes `displayName` and `fullDisplayName` for better UX
   - Coordinates are nested under `coordinates` object

3. **Leverage new features:**
   - Better search ranking
   - Faster autocomplete
   - More comprehensive airport data

## Monitoring

Monitor the following metrics:

- Cache hit rates
- Search response times
- AirportDB API response times
- Memory usage
- Rate limit violations

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify AirportDB API token is valid
3. Test with the provided test scripts
4. Check cache status via admin endpoints