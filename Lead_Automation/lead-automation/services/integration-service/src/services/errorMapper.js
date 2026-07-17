/**
 * src/services/errorMapper.js
 *
 * Translates Meta's raw Graph API error objects into a consistent,
 * actionable shape so the rest of the app (and any frontend) can branch
 * on a stable `category` instead of parsing Meta's free-text messages
 * or memorizing numeric codes everywhere.
 *
 * Meta error reference: https://developers.facebook.com/docs/graph-api/guides/error-handling
 */

const CATEGORY = {
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',       // token invalid/expired/revoked — needs reconnect
  PERMISSION_DENIED: 'PERMISSION_DENIED', // missing scope, or not an admin on the asset
  RATE_LIMITED: 'RATE_LIMITED',         // too many calls — safe to retry after a delay
  INVALID_REQUEST: 'INVALID_REQUEST',   // bad params on our side — not retryable as-is
  TEMPORARY: 'TEMPORARY',               // Meta-side hiccup — safe to retry shortly
  UNKNOWN: 'UNKNOWN',                   // anything we haven't explicitly mapped
};

/**
 * Maps a Meta Graph API error object (the `.error` field of a failed
 * response) to { category, message, retryable, httpStatus }.
 */
function mapMetaError(metaError) {
  if (!metaError || typeof metaError !== 'object') {
    return {
      category: CATEGORY.UNKNOWN,
      message: 'An unknown error occurred.',
      retryable: false,
      httpStatus: 500,
      raw: metaError,
    };
  }

  const code = metaError.code;
  const subcode = metaError.error_subcode;

  // Token invalid / expired / revoked / password changed
  if (code === 190) {
    return {
      category: CATEGORY.TOKEN_EXPIRED,
      message: 'The connection has expired or was revoked. Please reconnect the account.',
      retryable: false,
      httpStatus: 401,
      raw: metaError,
    };
  }

  // Permissions error — missing scope, or user isn't an admin on the Page/asset
  if (code === 200 || code === 10) {
    return {
      category: CATEGORY.PERMISSION_DENIED,
      message: 'This action requires a permission that has not been granted. The account may need to reconnect with additional permissions.',
      retryable: false,
      httpStatus: 403,
      raw: metaError,
    };
  }

  // Rate limiting — application level (4, 32) or user level (17), or ads/business rate limits (613)
  if ([4, 17, 32, 613].includes(code)) {
    return {
      category: CATEGORY.RATE_LIMITED,
      message: 'Too many requests right now. Please wait a bit and try again.',
      retryable: true,
      httpStatus: 429,
      raw: metaError,
    };
  }

  // Temporary Meta-side issue — safe to retry shortly
  if (code === 2 || code === 1) {
    return {
      category: CATEGORY.TEMPORARY,
      message: 'Meta is having a temporary issue. Please try again in a moment.',
      retryable: true,
      httpStatus: 503,
      raw: metaError,
    };
  }

  // Invalid parameter / bad request — code 100 covers most validation errors,
  // e.g. malformed image URL, unsupported video format, bad field names.
  if (code === 100) {
    return {
      category: CATEGORY.INVALID_REQUEST,
      message: metaError.message || 'The request was invalid. Please check the submitted data.',
      retryable: false,
      httpStatus: 400,
      raw: metaError,
    };
  }

  // Instagram-specific: media could not be downloaded from the given URL,
  // or isn't a supported photo/video format.
  if (code === 9004) {
    return {
      category: CATEGORY.INVALID_REQUEST,
      message: 'The image or video could not be fetched or is not a supported format. Make sure the URL is public and points directly to a photo or video file.',
      retryable: false,
      httpStatus: 400,
      raw: metaError,
    };
  }

  // Anything else — pass through Meta's own message, but keep it in our shape
  return {
    category: CATEGORY.UNKNOWN,
    message: metaError.message || 'An unexpected error occurred with the Meta API.',
    retryable: false,
    httpStatus: 400,
    raw: metaError,
  };
}

module.exports = { mapMetaError, CATEGORY };