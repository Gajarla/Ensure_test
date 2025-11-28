// Function used to search particular attribute when the object structure is dynamic

// What It Does:
// It searches through the object recursively, including all nested objects.
// It stops at the first occurrence of the target key and returns its value.
// If the key isn't found, it returns undefined.

const findVal = (object, key) => {
  let value;
  Object.keys(object).some((k) => {
    if (k === key) {
      value = object[k];
      return true;
    }
    if (object[k] && typeof object[k] === 'object') {
      value = findVal(object[k], key);
      return value !== undefined;
    }
    return value;
  });
  return value;
};

export { findVal };
