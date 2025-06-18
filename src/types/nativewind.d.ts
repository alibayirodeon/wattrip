/// <reference types="nativewind/types" />

declare module 'nativewind' {
  import type { ViewProps } from 'react-native';
  
  export interface StyledProps extends ViewProps {
    className?: string;
  }
} 