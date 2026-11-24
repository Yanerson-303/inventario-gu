module.exports = function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).end();
  }
  const value = (process.env.GOOGLE_DRIVE_CLIENT_ID || '').trim();
  const clientId = /^[\w-]+\.apps\.googleusercontent\.com$/.test(value) ? value : '';
  return response.status(200).json({clientId});
};
