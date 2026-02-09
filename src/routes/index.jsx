import { AnimatePresence } from 'framer-motion'
import React, { Suspense } from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'
import PageAnimate from '../components/Animation/PageAnimate'
import LayoutClassic from '../layout/MainLayout/ClassicLayout'
import { routes } from './RouteList'

const MainRoutes = () => {
    return (
        <>
            <AnimatePresence>
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
                                            path={obj.path}
                                            render={matchProps => (
                                                <>
                                                    <PageAnimate>
                                                        <obj.component {...matchProps} />
                                                    </PageAnimate>

                                                </>

                                            )}
                                        />) : (null)
                                })
                            }
                            <Redirect exact from='/' to='/dashboard' />
                        </Switch>
                    </LayoutClassic>
                </Suspense>
            </AnimatePresence>
        </>
    )
}

export default MainRoutes
