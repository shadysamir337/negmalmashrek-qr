import { Component } from 'react'

// Catches any React render error and shows a friendly recovery screen
// instead of a blank page.
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary]', error, info)
    }

    render() {
        if (this.state.error) {
            return (
                <div className="min-h-screen flex items-center justify-center p-6">
                    <div className="card p-8 max-w-md w-full text-center">
                        <div className="text-5xl mb-3">😵</div>
                        <h1 className="text-xl font-bold mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-sm text-slate-600 mb-4">
                            {this.state.error?.message || 'An unexpected error occurred.'}
                        </p>
                        <button
                            onClick={() => location.reload()}
                            className="btn btn-primary w-full"
                        >
                            Reload app
                        </button>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}
