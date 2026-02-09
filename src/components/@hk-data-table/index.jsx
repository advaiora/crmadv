import React from 'react';
import PropTypes from 'prop-types';
import useSortableData from './hooks/useSortableData';
import useTablePageSize from './hooks/useTablePageSize';
import classNames from 'classnames';
import { Form, Table } from 'react-bootstrap';
import { Star } from 'react-feather';
import { ArrowsSort, SortAscending, SortDescending } from 'tabler-icons-react';
import TableFooter from './TableFooter';
import useRowSelect from './hooks/useRowSelect';
import useStarred from './hooks/useStarred';

const HkDataTable = ({
    column,
    rowData,
    bsPrefix,
    classes,
    striped,
    bordered,
    borderless,
    hover,
    size,
    variant,
    responsive,
    rowsPerPage,
    paginatorSize,
    rowSelection,
    searchBar,
    searchQuery,
    searchClasses,
    markStarred,
    ...rest
}) => {

    const [data, setData] = React.useState(rowData);
    const [page, setPage] = React.useState(1);
    const [searchTerm, setSearchTerm] = React.useState('');
    // custom hooks for data table
    const { items, requestSort, sortConfig } = useSortableData(data);
    const { slice, range } = useTablePageSize(items, page, rowsPerPage);
    const { selectAll, handleRowSelection, handleSelectAll, isRowSelected } = useRowSelect(slice, data);
    const { handleStared, favData } = useStarred(rowData);

    //Search Filter
    React.useEffect(() => {
        if (searchQuery) {
            setSearchTerm(searchQuery);
        }
        else {
            setSearchTerm('');
        }
    }, [searchQuery])

    const filteredData = slice.filter((item) =>
        searchTerm === '' ? item : Object.values(item).some((value) =>
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    // Add Favorites
    React.useEffect(() => {
        setData(favData)
    }, [favData])

    return (
        <>
            {(searchBar && !searchQuery) && <Form.Group controlId="searchForm" className="mb-3">
                <Form.Control
                    type="search"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={searchClasses}
                />
            </Form.Group>}
            <Table
                bsPrefix={bsPrefix}
                className={classNames("hk-data-table", classes)}
                striped={striped}
                bordered={bordered}
                borderless={borderless}
                hover={hover}
                size={size}
                variant={variant}
                responsive={responsive}
                {...rest}
            >
                <thead>
                    <tr>
                        {(rowSelection || markStarred) && <th>
                            {rowSelection ? <Form.Check
                                type="checkbox"
                                className="fs-6 mb-0"
                                checked={selectAll}
                                onChange={handleSelectAll}
                            />
                                :
                                <></>
                            }

                        </th>}
                        {column.map((cols, index) => (
                            <th
                                key={index}
                                onClick={() => requestSort(cols.sort, cols.accessor)}
                                className={classNames({ 'd-none': cols.hidden }, { "text-primary": sortConfig !== null && sortConfig.key === cols.accessor }, cols.className)}
                                rowSpan={cols.rowSpan}
                            >
                                <span className="d-flex">
                                    <span className="flex-grow-1">
                                        {cols.title}
                                    </span>
                                    {
                                        cols.sort &&
                                        <span>
                                            {(sortConfig !== null && cols.accessor === sortConfig.key)
                                                ?
                                                <>
                                                    {
                                                        (sortConfig.direction === 'ascending')
                                                            ?
                                                            <font color="#007D88">
                                                                <SortAscending size={14} strokeWidth={2.5} />
                                                            </font>
                                                            :
                                                            <font color="#007D88">
                                                                <SortDescending size={14} strokeWidth={2.5} />
                                                            </font>
                                                    }
                                                </>
                                                :
                                                <span><ArrowsSort size={14} strokeWidth={2.5} /> </span>}
                                        </span>
                                    }
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {/* slice.map */}
                    {filteredData.map((row, index) => (
                        <tr key={index} className={classNames({ "selected": isRowSelected(index) })}>
                            {(rowSelection || markStarred) && <td>
                                <div className="d-flex align-items-center">
                                    {rowSelection && <Form.Check
                                        type="checkbox"
                                        className="form-check fs-6 mb-0"
                                        checked={isRowSelected(index)}
                                        onChange={() => handleRowSelection(index)}
                                    />}
                                    {markStarred && <span className={classNames("fav-star", { "marked": row.starred })} onClick={() => handleStared(index)} >
                                        <span className="feather-icon">
                                            <Star />
                                        </span>
                                    </span>}
                                </div>
                            </td>}
                            {column.map((cols, index) => (
                                <td
                                    key={index}
                                    className={classNames({ 'd-none': cols.hidden }, cols.tdClasses)}
                                >
                                    {
                                        cols.cellFormatter
                                            ?
                                            cols.cellFormatter(row[cols.accessor])
                                            :
                                            row[cols.accessor]
                                    }
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </Table >
            {rowsPerPage && <TableFooter
                range={range}
                slice={slice}
                setPage={setPage}
                page={page}
                totalRows={data}
                paginatorSize={paginatorSize}
            />}
        </>
    )
}

HkDataTable.propTypes = {
    column: PropTypes.array.isRequired,
    rowData: PropTypes.array.isRequired,
    bsPrefix: PropTypes.string,
    classes: PropTypes.string,
    striped: PropTypes.bool,
    bordered: PropTypes.bool,
    borderless: PropTypes.bool,
    hover: PropTypes.bool,
    size: PropTypes.string,
    variant: PropTypes.string,
    responsive: PropTypes.bool,
    rowsPerPage: PropTypes.number,
    paginatorSize: PropTypes.string,
    rowSelection: PropTypes.bool,
    searchBar: PropTypes.bool,
    searchQuery: PropTypes.string,
    searchClasses: PropTypes.string,
    markStarred: PropTypes.bool,
}

export default HkDataTable
