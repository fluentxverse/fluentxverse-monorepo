import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import './Skeleton.css';
interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    className?: string;
    animate?: boolean;
}
// Base skeleton element
export function Skeleton(_props0: SkeletonProps) {
    const style = {
        get width() {
            return typeof (_props0["width"] === undefined ? '100%' : _props0["width"]) === 'number' ? `${_props0["width"] === undefined ? '100%' : _props0["width"]}px` : _props0["width"] === undefined ? '100%' : _props0["width"];
        },
        get height() {
            return typeof (_props0["height"] === undefined ? '1em' : _props0["height"]) === 'number' ? `${_props0["height"] === undefined ? '1em' : _props0["height"]}px` : _props0["height"] === undefined ? '1em' : _props0["height"];
        },
        get borderRadius() {
            return typeof (_props0["borderRadius"] === undefined ? '4px' : _props0["borderRadius"]) === 'number' ? `${_props0["borderRadius"] === undefined ? '4px' : _props0["borderRadius"]}px` : _props0["borderRadius"] === undefined ? '4px' : _props0["borderRadius"];
        }
    };
    return (<div class={`skeleton ${(_props0["animate"] === undefined ? true : _props0["animate"]) ? 'skeleton-animate' : ''} ${_props0["className"] === undefined ? '' : _props0["className"]}`} style={cssStyle(style)} aria-hidden="true"/>);
}
// Text line skeleton
interface SkeletonTextProps {
    lines?: number;
    lastLineWidth?: string;
    lineHeight?: string | number;
    gap?: string | number;
    className?: string;
}
export function SkeletonText(_props1: SkeletonTextProps) {
    return (<div class={`skeleton-text ${_props1["className"] === undefined ? '' : _props1["className"]}`} style={cssStyle({ get gap() {
            return typeof (_props1["gap"] === undefined ? 8 : _props1["gap"]) === 'number' ? `${_props1["gap"] === undefined ? 8 : _props1["gap"]}px` : _props1["gap"] === undefined ? 8 : _props1["gap"];
        } })}>
      {Array.from({ get length() {
                return _props1["lines"] === undefined ? 3 : _props1["lines"];
            } }).map((_, index) => (<Skeleton height={_props1["lineHeight"] === undefined ? '1em' : _props1["lineHeight"]} width={index === (_props1["lines"] === undefined ? 3 : _props1["lines"]) - 1 ? _props1["lastLineWidth"] === undefined ? '60%' : _props1["lastLineWidth"] : '100%'}/>))}
    </div>);
}
// Avatar/Circle skeleton
interface SkeletonAvatarProps {
    size?: number | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}
export function SkeletonAvatar(_props2: SkeletonAvatarProps) {
    const sizeMap = {
        sm: 32,
        md: 40,
        lg: 56,
        xl: 80
    };
    const pixelSize = createMemo(() => typeof (_props2["size"] === undefined ? 'md' : _props2["size"]) === 'number' ? _props2["size"] === undefined ? 'md' : _props2["size"] : sizeMap[_props2["size"] === undefined ? 'md' : _props2["size"]]);
    return (<Skeleton width={pixelSize()} height={pixelSize()} borderRadius="50%" className={`skeleton-avatar ${_props2["className"] === undefined ? '' : _props2["className"]}`}/>);
}
// Image/Thumbnail skeleton
interface SkeletonImageProps {
    width?: string | number;
    height?: string | number;
    aspectRatio?: string;
    className?: string;
}
export function SkeletonImage(_props3: SkeletonImageProps) {
    return (<Skeleton width={_props3["width"] === undefined ? '100%' : _props3["width"]} height={_props3["height"] || 'auto'} borderRadius={8} className={`skeleton-image ${_props3["className"] === undefined ? '' : _props3["className"]}`}/>);
}
// Card skeleton
interface SkeletonCardProps {
    showImage?: boolean;
    showAvatar?: boolean;
    titleLines?: number;
    descriptionLines?: number;
    className?: string;
}
export function SkeletonCard(_props4: SkeletonCardProps) {
    return (<div class={`skeleton-card ${_props4["className"] === undefined ? '' : _props4["className"]}`}>
      {(_props4["showImage"] === undefined ? true : _props4["showImage"]) && (<div class="skeleton-card-image">
          <Skeleton height={160} borderRadius="8px 8px 0 0"/>
        </div>)}
      <div class="skeleton-card-content">
        {(_props4["showAvatar"] === undefined ? false : _props4["showAvatar"]) && (<div class="skeleton-card-header">
            <SkeletonAvatar size="md"/>
            <div class="skeleton-card-meta">
              <Skeleton width="60%" height={14}/>
              <Skeleton width="40%" height={12}/>
            </div>
          </div>)}
        <SkeletonText lines={_props4["titleLines"] === undefined ? 1 : _props4["titleLines"]} lineHeight={20} gap={6}/>
        <div style={cssStyle({ marginTop: '8px' })}>
          <SkeletonText lines={_props4["descriptionLines"] === undefined ? 2 : _props4["descriptionLines"]} lineHeight={14} gap={4}/>
        </div>
      </div>
    </div>);
}
// Table row skeleton
interface SkeletonTableRowProps {
    columns?: number;
    className?: string;
}
export function SkeletonTableRow(_props5: SkeletonTableRowProps) {
    return (<div class={`skeleton-table-row ${_props5["className"] === undefined ? '' : _props5["className"]}`}>
      {Array.from({ get length() {
                return _props5["columns"] === undefined ? 4 : _props5["columns"];
            } }).map((_, index) => (<div class="skeleton-table-cell">
          <Skeleton width={`${60 + Math.random() * 30}%`} height={16}/>
        </div>))}
    </div>);
}
// Table skeleton
interface SkeletonTableProps {
    rows?: number;
    columns?: number;
    showHeader?: boolean;
    className?: string;
}
export function SkeletonTable(_props6: SkeletonTableProps) {
    return (<div class={`skeleton-table ${_props6["className"] === undefined ? '' : _props6["className"]}`}>
      {(_props6["showHeader"] === undefined ? true : _props6["showHeader"]) && (<div class="skeleton-table-header">
          {Array.from({ get length() {
                    return _props6["columns"] === undefined ? 4 : _props6["columns"];
                } }).map((_, index) => (<div class="skeleton-table-cell">
              <Skeleton width={`${50 + Math.random() * 30}%`} height={14}/>
            </div>))}
        </div>)}
      <div class="skeleton-table-body">
        {Array.from({ get length() {
                return _props6["rows"] === undefined ? 5 : _props6["rows"];
            } }).map((_, index) => (<SkeletonTableRow columns={_props6["columns"] === undefined ? 4 : _props6["columns"]}/>))}
      </div>
    </div>);
}
// List item skeleton
interface SkeletonListItemProps {
    showAvatar?: boolean;
    showAction?: boolean;
    titleWidth?: string;
    subtitleWidth?: string;
    className?: string;
}
export function SkeletonListItem(_props7: SkeletonListItemProps) {
    return (<div class={`skeleton-list-item ${_props7["className"] === undefined ? '' : _props7["className"]}`}>
      {(_props7["showAvatar"] === undefined ? true : _props7["showAvatar"]) && <SkeletonAvatar size="md"/>}
      <div class="skeleton-list-item-content">
        <Skeleton width={_props7["titleWidth"] === undefined ? '70%' : _props7["titleWidth"]} height={16}/>
        <Skeleton width={_props7["subtitleWidth"] === undefined ? '50%' : _props7["subtitleWidth"]} height={14}/>
      </div>
      {(_props7["showAction"] === undefined ? false : _props7["showAction"]) && <Skeleton width={60} height={32} borderRadius={6}/>}
    </div>);
}
// List skeleton
interface SkeletonListProps {
    items?: number;
    showAvatar?: boolean;
    showAction?: boolean;
    className?: string;
}
export function SkeletonList(_props8: SkeletonListProps) {
    return (<div class={`skeleton-list ${_props8["className"] === undefined ? '' : _props8["className"]}`}>
      {Array.from({ get length() {
                return _props8["items"] === undefined ? 5 : _props8["items"];
            } }).map((_, index) => (<SkeletonListItem showAvatar={_props8["showAvatar"] === undefined ? true : _props8["showAvatar"]} showAction={_props8["showAction"] === undefined ? false : _props8["showAction"]} titleWidth={`${60 + Math.random() * 25}%`} subtitleWidth={`${40 + Math.random() * 20}%`}/>))}
    </div>);
}
// Schedule/Calendar skeleton
export function SkeletonSchedule(_props9: {
    days?: number;
    slots?: number;
    className?: string;
}) {
    return (<div class={`skeleton-schedule ${_props9["className"] === undefined ? '' : _props9["className"]}`}>
      <div class="skeleton-schedule-header">
        {Array.from({ get length() {
                return _props9["days"] === undefined ? 7 : _props9["days"];
            } }).map((_, index) => (<div class="skeleton-schedule-day-header">
            <Skeleton width={40} height={14}/>
            <Skeleton width={24} height={24} borderRadius="50%"/>
          </div>))}
      </div>
      <div class="skeleton-schedule-body">
        {Array.from({ get length() {
                return _props9["slots"] === undefined ? 4 : _props9["slots"];
            } }).map((_, slotIndex) => (<div class="skeleton-schedule-row">
            <div class="skeleton-schedule-time">
              <Skeleton width={50} height={14}/>
            </div>
            {Array.from({ get length() {
                    return _props9["days"] === undefined ? 7 : _props9["days"];
                } }).map((_, dayIndex) => (<div class="skeleton-schedule-slot">
                <Skeleton width="100%" height={36} borderRadius={6}/>
              </div>))}
          </div>))}
      </div>
    </div>);
}
// Profile skeleton
export function SkeletonProfile(_props10: {
    className?: string;
}) {
    return (<div class={`skeleton-profile ${_props10["className"] === undefined ? '' : _props10["className"]}`}>
      <div class="skeleton-profile-header">
        <SkeletonAvatar size="xl"/>
        <div class="skeleton-profile-info">
          <Skeleton width={180} height={24}/>
          <Skeleton width={120} height={16}/>
          <Skeleton width={140} height={14}/>
        </div>
      </div>
      <div class="skeleton-profile-stats">
        {Array.from({ length: 3 }).map((_, index) => (<div class="skeleton-profile-stat">
            <Skeleton width={40} height={28}/>
            <Skeleton width={60} height={12}/>
          </div>))}
      </div>
      <div class="skeleton-profile-bio">
        <SkeletonText lines={3}/>
      </div>
    </div>);
}
// Lesson card skeleton (specific to FluentXVerse)
export function SkeletonLessonCard(_props11: {
    className?: string;
}) {
    return (<div class={`skeleton-lesson-card ${_props11["className"] === undefined ? '' : _props11["className"]}`}>
      <Skeleton height={140} borderRadius="12px 12px 0 0"/>
      <div class="skeleton-lesson-card-content">
        <div class="skeleton-lesson-card-badges">
          <Skeleton width={50} height={22} borderRadius={11}/>
          <Skeleton width={70} height={22} borderRadius={11}/>
        </div>
        <Skeleton width="90%" height={18}/>
        <Skeleton width="70%" height={14}/>
        <div class="skeleton-lesson-card-footer">
          <Skeleton width={80} height={14}/>
          <Skeleton width={60} height={28} borderRadius={6}/>
        </div>
      </div>
    </div>);
}
// Tutor card skeleton
export function SkeletonTutorCard(_props12: {
    className?: string;
}) {
    return (<div class={`skeleton-tutor-card ${_props12["className"] === undefined ? '' : _props12["className"]}`}>
      <div class="skeleton-tutor-card-header">
        <SkeletonAvatar size="lg"/>
        <Skeleton width={60} height={24} borderRadius={12} className="skeleton-tutor-badge"/>
      </div>
      <Skeleton width="80%" height={18}/>
      <Skeleton width="60%" height={14}/>
      <div class="skeleton-tutor-card-rating">
        <Skeleton width={80} height={16}/>
      </div>
      <SkeletonText lines={2} lineHeight={12}/>
      <div class="skeleton-tutor-card-footer">
        <Skeleton width={70} height={20}/>
        <Skeleton width={80} height={36} borderRadius={8}/>
      </div>
    </div>);
}
// Wrapper for conditional skeleton display
interface SkeletonWrapperProps {
    loading: boolean;
    skeleton: JSX.Element;
    children: JSX.Element;
}
export function SkeletonWrapper(_props13: SkeletonWrapperProps) {
    return _props13["loading"] ? <>{_props13["skeleton"]}</> : <>{_props13["children"]}</>;
}
export default Skeleton;
