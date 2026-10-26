'use client'

import { Component, type ReactNode } from 'react'

/**
 * Around the globe: anything it throws while it renders, or its code
 * failing to load, ends here, said to the shell as a failure, and the flat
 * map under it carries on untouched. The globe is a showpiece; nothing may
 * depend on it.
 */
export class GlobeFrame extends Component<
  { children: ReactNode; onFail: (reason: 'error') => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(): void {
    this.props.onFail('error')
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
