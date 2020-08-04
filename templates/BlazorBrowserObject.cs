using System.Text.Json.Serialization;


namespace BlazorBrowser{% if objectNamespace %}.{% endif %}{{objectNamespace}}
{
    public class {{objectName}}
        {% if extendedClasses %}: {% endif %}
        {%- for cls in extendedClasses -%}
          {{- cls }}{{ ", " if not loop.last }}
        {%- endfor %}
    {
        {%- for prop_name, prop_info in properties %}
            {% if prop_info.isMethod %}
                public {{ prop_info.type }} {{ prop_name[0].toUpperCase() +
                                               prop_name.slice(1) }}()
               {
               }
            {% else %}
                public {{ prop_info.type }} {{ prop_name[0].toUpperCase() +
                                               prop_name.slice(1) }} { get; {% if prop_info.isReadonly %}internal{% endif %} set; }
            {% endif %}
        {%- endfor %}
    }
}
