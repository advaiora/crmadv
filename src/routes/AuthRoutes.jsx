import { AnimatePresence } from 'framer-motion'
import classNames from 'classnames'
import { Suspense } from 'react'
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom'
import { authRoutes } from './RouteList'
import PageAnimate from '../components/Animation/PageAnimate'


const ClassicRoutes = (props) => {

    const { match } = props;

    const lockScreenAuth = useRouteMatch("/auth/lock-screen");

    return (
        <AnimatePresence>
            <Suspense
                fallback={
                    <div className="preloader-it">
                        <div className="loader-pendulums" />
                    </div>
                }>
                <div className={classNames("hk-wrapper hk-pg-auth", { "bg-primary-dark-3": lockScreenAuth })} data-footer="simple" >
                    <Switch>

                        {
                            authRoutes.map((obj, i) => {
                                return (obj.component) ? (
                                    <Route
                                        key={i}
                                        exact={obj.exact}
                                        path={match.path + obj.path}
                                        render={matchProps => (
                                            <PageAnimate>
                                                <obj.component {...matchProps} />
                                            </PageAnimate>
                                        )}
                                    />) : (null)
                            })
                        }
                        <Route path="*">
                            <Redirect to="/error-404" />
                        </Route>
                    </Switch>
                </div>
            </Suspense>
        </AnimatePresence>
    )
}

export default ClassicRoutes
