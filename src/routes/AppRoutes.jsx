import React, { Suspense } from 'react'
import { Route, Redirect, Switch } from 'react-router-dom'
import LayoutClassic from '../layout/MainLayout/ClassicLayout'
import { routes } from './RouteList'

const AppRoutes = (props) => {

    const { match } = props;

    return (
        <Suspense
            fallback={
                <div className="preloader-it">
                    <div className="loader-pendulums" />
                </div>
            }>
            <LayoutClassic>
                <Switch>

                    {
                        routes.map((obj, i) => {
                            return (obj.component) ? (
                                <Route
                                    key={i}
                                    exact={obj.exact}
                                    path={match.path + obj.path}
                                    render={matchProps => (
                                        <obj.component {...matchProps} />
                                    )}
                                />) : (null)
                        })
                    }
                    <Route path="*">
                        <Redirect to="/error-404" />
                    </Route>
                </Switch>
            </LayoutClassic>
        </Suspense>
    )
}

export default AppRoutes
