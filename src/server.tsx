import React from 'react';
import { renderToString } from 'react-dom/server';
import { Button } from './components';

export const renderButton = (props) => {
  return renderToString(<Button {...props} />);
};