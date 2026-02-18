# Reference Data API Documentation

This document describes the Reference Data API endpoints that provide airports and countries data for use with Amadeus flight search and other travel services.

## Overview

The Reference Data API provides cached, optimized access to:
- **Airports**: IATA airport codes, names, locations, and details
- **Countries**: Country codes and names for travel destinations

All endpoints are designed to work seamlessly with Amadeus API requirements and provide fast, cached responses for better performance.

## Base URL

```
https://your-api-domain.com/api/v1/reference
```

## Authentication

Most endpoints are **public** and don't require authentication. Admin endpoints require authentication and admin role.

## Endpoints

### 1. Get Airports List

Get a list of popular airports worldwide.

```http
GET /airports
```

**Query Parameters:**
- `keyword` (optional): Search for specific airports/cities
- `limit` (optional): Maximum results (1-100, default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```bash
curl "https://api.example.com/api/v1/reference/airports?limit=10"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Airports retrieved successfully",
  "data": [
    {
      "id": "ALHR",
      "type": "location",
      "subType": "AIRPORT",
      "name": "HEATHROW",
      "detailedName": "LONDON/GB:HEATHROW",
      "iataCode": "LHR",
      "address": {
        "cityName": "LONDON",
        "cityCode": "LON",
        "countryName": "UNITED KINGDOM",
        "countryCode": "GB",
        "regionCode": "EUROP"
      },
      "geoCode": {
        "latitude": 51.4775,
        "longitude": -0.46139
      },
      "timeZoneOffset": "+01:00"
    }
  ],
  "meta": {
    "count": 150,
    "cached": true,
    "cacheAge": 3600000
  }
}
```

### 2. Search Airports

Search for airports by keyword, city name, or IATA code.

```http
GET /airports/search?q={query}
```

**Query Parameters:**
- `q` (required): Search query (minimum 2 characters)
- `limit` (optional): Maximum results (1-50, default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```bash
curl "https://api.example.com/api/v1/reference/airports/search?q=london&limit=5"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Found 5 airports matching \"london\"",
  "data": [
    {
      "id": "ALHR",
      "name": "HEATHROW",
      "iataCode": "LHR",
      "address": {
        "cityName": "LONDON",
        "countryName": "UNITED KINGDOM"
      }
    }
  ],
  "meta": {
    "query": "london",
    "count": 5
  }
}
```

### 3. Get Airport Details

Get detailed information about a specific airport by IATA code.

```http
GET /airports/{iataCode}
```

**Path Parameters:**
- `iataCode`: 3-letter IATA airport code (e.g., JFK, LHR, DXB)

**Example Request:**
```bash
curl "https://api.example.com/api/v1/reference/airports/JFK"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Airport details retrieved for JFK",
  "data": {
    "id": "AJFK",
    "name": "JOHN F KENNEDY INTL",
    "iataCode": "JFK",
    "address": {
      "cityName": "NEW YORK",
      "countryName": "UNITED STATES OF AMERICA"
    },
    "geoCode": {
      "latitude": 40.63975,
      "longitude": -73.77893
    }
  }
}
```

### 4. Get Countries List

Get a list of countries commonly used for travel.

```http
GET /countries
```

**Example Request:**
```bash
curl "https://api.example.com/api/v1/reference/countries"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Countries retrieved successfully",
  "data": [
    {
      "code": "US",
      "name": "United States",
      "continent": "North America"
    },
    {
      "code": "GB",
      "name": "United Kingdom",
      "continent": "Europe"
    },
    {
      "code": "FR",
      "name": "France",
      "continent": "Europe"
    }
  ],
  "meta": {
    "count": 80,
    "cached": true
  }
}
```

## Admin Endpoints

### 5. Get Cache Status (Admin Only)

Get information about the reference data cache.

```http
GET /cache/status
```

**Authentication Required:** Yes (Admin role)

**Example Response:**
```json
{
  "success": true,
  "message": "Cache status retrieved successfully",
  "data": {
    "airports": {
      "cached": true,
      "count": 150,
      "valid": true
    },
    "countries": {
      "cached": true,
      "count": 80,
      "valid": true
    },
    "cacheTimestamp": 1703123456789,
    "cacheAge": 3600000,
    "cacheDuration": 86400000
  }
}
```

### 6. Clear Cache (Admin Only)

Clear the reference data cache to force fresh data retrieval.

```http
POST /cache/clear
```

**Authentication Required:** Yes (Admin role)

**Example Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully",
  "data": {
    "success": true,
    "message": "Cache cleared successfully",
    "timestamp": "2023-12-21T10:30:56.789Z"
  }
}
```

## Using with Amadeus Flight Search

The airport data from these endpoints can be directly used with Amadeus flight search APIs:

```javascript
// Get airports for user selection
const airports = await fetch('/api/v1/reference/airports/search?q=london');

// Use IATA codes in flight search
const flightSearch = {
  originLocationCode: 'LHR',  // From airport endpoint
  destinationLocationCode: 'JFK',  // From airport endpoint
  departureDate: '2024-01-15',
  adults: 1
};
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

**Common Error Codes:**
- `MISSING_QUERY_PARAMETER`: Required query parameter missing
- `QUERY_TOO_SHORT`: Search query less than 2 characters
- `INVALID_IATA_CODE`: Invalid IATA code format
- `AIRPORT_NOT_FOUND`: Airport not found for given IATA code

## Rate Limiting

- **Standard Rate Limit**: 100 requests per 15 minutes per IP
- **Burst Limit**: 20 requests per minute per IP
- **Admin Endpoints**: 50 requests per 15 minutes per user

## Caching

- **Airports**: Cached for 24 hours
- **Countries**: Cached for 24 hours
- **Search Results**: Cached for 5 minutes
- **HTTP Cache Headers**: Set appropriately for client-side caching

## Performance Notes

1. **Use General Lists**: For dropdowns, use `/airports` instead of searching
2. **Cache Client-Side**: Respect HTTP cache headers for better performance
3. **Pagination**: Use `limit` and `offset` for large result sets
4. **Search Optimization**: Use specific keywords for better search results

## Integration Examples

### Frontend Autocomplete

```javascript
// Debounced airport search for autocomplete
const searchAirports = async (query) => {
  if (query.length < 2) return [];
  
  const response = await fetch(
    `/api/v1/reference/airports/search?q=${encodeURIComponent(query)}&limit=10`
  );
  const data = await response.json();
  
  return data.data.map(airport => ({
    value: airport.iataCode,
    label: `${airport.name} (${airport.iataCode})`,
    city: airport.address?.cityName,
    country: airport.address?.countryName
  }));
};
```

### Country Dropdown

```javascript
// Load countries for destination selection
const loadCountries = async () => {
  const response = await fetch('/api/v1/reference/countries');
  const data = await response.json();
  
  return data.data.map(country => ({
    value: country.code,
    label: country.name,
    continent: country.continent
  }));
};
```

## Support

For questions or issues with the Reference Data API, please contact the development team or check the main API documentation.