import React from 'react';

export default class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('🧨 ErrorBoundary caught an error:', error);
    console.error('📌 Component stack:', errorInfo.componentStack);
  }

  render() {
    return this.props.children;
  }
}
