// Create React App loads this file before every frontend test suite.
// It registers the custom DOM matchers (toHaveTextContent, toBeDisabled, ...).
// @testing-library/jest-dom was already a dependency, but this file was missing,
// so none of its matchers were available.
import '@testing-library/jest-dom';
