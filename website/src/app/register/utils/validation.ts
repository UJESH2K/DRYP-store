export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const validateEmailForm = (form: {
  studioName: string;
  email: string;
  websiteOrPortfolio: string;
}): Partial<Record<keyof typeof form, string>> => {
  const errors: Partial<Record<keyof typeof form, string>> = {};

  if (!form.studioName.trim()) {
    errors.studioName = "Required";
  }

  if (!form.email.trim()) {
    errors.email = "Required";
  } else if (!emailRegex.test(form.email)) {
    errors.email = "Invalid format";
  }

  if (!form.websiteOrPortfolio.trim()) {
    errors.websiteOrPortfolio = "Required";
  } else if (!isValidUrl(form.websiteOrPortfolio)) {
    errors.websiteOrPortfolio = "Must be a valid http(s) URL";
  }

  return errors;
};

export const validateGoogleForm = (form: {
  studioName: string;
  websiteOrPortfolio: string;
}): Partial<Record<keyof typeof form, string>> => {
  const errors: Partial<Record<keyof typeof form, string>> = {};

  if (!form.studioName.trim()) {
    errors.studioName = "Required";
  }

  if (!form.websiteOrPortfolio.trim()) {
    errors.websiteOrPortfolio = "Required";
  } else if (!isValidUrl(form.websiteOrPortfolio)) {
    errors.websiteOrPortfolio = "Must be a valid http(s) URL";
  }

  return errors;
};

export const isGoogleFormValid = (form: {
  studioName: string;
  websiteOrPortfolio: string;
}): boolean => {
  return form.studioName.trim() !== "" && isValidUrl(form.websiteOrPortfolio);
};