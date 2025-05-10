//this file is used to handle the request for the time series data from the GEE API
import { getTimeSeriesData } from '$lib/services/gee-service';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    const { satellite, index, startDate, endDate, geometry } = body;

    if (!satellite || !index || !startDate || !endDate || !geometry) {
      return new Response(JSON.stringify({ message: 'Missing parameters' }), { status: 400 });
    }

    const data = await getTimeSeriesData({
      satellite,
      index,
      startDate,
      endDate,
      geometry
    });

    return new Response(JSON.stringify({ data }), { status: 200 });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ message: 'Server error' }), { status: 500 });
  }
};
