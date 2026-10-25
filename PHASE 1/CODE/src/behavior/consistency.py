def behaviour_shap_consistency(behavior_data, aggregated_global, k=5):
    """
    Proposed consistency measure: overlap between top-K
    behaviour features and top-K SHAP features.

    This is not an established scientific metric.
    """

    behaviour_features = []
    seen = set()
    for item in behavior_data.get("top_patterns") or []:
        feature = item.get("feature")
        if not feature or feature in seen:
            continue
        seen.add(feature)
        behaviour_features.append(feature)
        if len(behaviour_features) >= k:
            break

    shap_features = []
    if aggregated_global is not None and len(aggregated_global) > 0:
        column = (
            "original_feature"
            if "original_feature" in aggregated_global.columns
            else "feature"
        )
        shap_features = (
            aggregated_global[column]
            .astype(str)
            .tolist()
        )
        unique = []
        seen_shap = set()
        for feature in shap_features:
            if feature in seen_shap:
                continue
            seen_shap.add(feature)
            unique.append(feature)
        shap_features = unique[:k]

    overlap = [feature for feature in behaviour_features if feature in set(shap_features)]
    denom = max(min(k, len(behaviour_features), len(shap_features)), 1)
    overlap_rate = len(overlap) / denom if (behaviour_features and shap_features) else 0.0

    return {
        "measure": "Behaviour-SHAP Top-K Consistency",
        "note": (
            "This is a proposed consistency measure for this research "
            "prototype. It is not an established scientific metric."
        ),
        "k": k,
        "behaviour_top_features": behaviour_features,
        "shap_top_features": shap_features,
        "overlap_features": overlap,
        "overlap_count": len(overlap),
        "overlap_rate": round(float(overlap_rate), 4),
    }
