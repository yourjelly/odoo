COMMON_STYLE = """
body {
    @charset "UTF-8";
    padding: 80px;
    font-family: Roboto, Ubuntu, "Noto Sans", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    font-size: 2em;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center center;
    background-attachment: fixed;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: vertical;
    flex-direction: column;
    -webkit-box-pack: justify;
    justify-content: space-around;
}
.header {
    -webkit-line-clamp: 2;
    max-height: 2.5em;
    line-height: 1.2em;
}
.header, .subheader, .cta_button h1 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.header, .subheader, .cta_button h1 {
    margin: 0.1em;
}
.subheader, .cta_button h1{
    -webkit-line-clamp: 1;
    max-height: 2em;
    line-height: 1.2em;
}
.cta_button {
    text-align: center;
    width: fit-content;
    min-width: 30%;
    max-width: 50%;
    padding: 0.2rem 1rem;
}
.rounded_button {
    border-radius: 100px;
}
.rounded_rectangle_button {
    border-radius: 16px;
}
.footer {
    width: 100%;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: horizontal;
    flex-direction: row;
    -webkit-box-pack: justify;
    justify-content: space-between;
}
.footer &gt; div {
    height: 100%;
}
.profile_section {
    margin-right: 0.5rem;
    font-size: 2.5rem;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: horizontal;
    flex-direction: row;
    -webkit-box-align: center;
    align-items: center;
}
.text_section {
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: vertical;
    flex-direction: column;
    -webkit-box-align: start;
    align-items: flex-start;
    align-content: flex-start;
    -webkit-box-pack: center;
    justify-content: center;
}
.profile_section .text_section .text_subsections {
    font-size: 2rem;
    margin-left: 1rem;
}
"""

TEMPLATE_1_STYLE = """
body {
    -webkit-box-align: center;
    align-items: center;
}
.center_column {
    text-align: center;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: vertical;
    flex-direction: column;
    -webkit-box-align: center;
    align-items: center;
    -webkit-box-pack: justify;
    justify-content: space-around;
    line-height: 4rem;
    height: 60%;
    width: 100%;
}
.center_column .cta_button {
    min-width: 50%;
    max-width: 70%;
}
.footer {
    -webkit-box-align: center;
    align-items: center;
    height: 30%;
}
.profile_section img {
    object-fit: cover;
    border-radius: 100px;
}
.profile_section .text_section span {
    display: block;
}
.logo {
    max-height: 80px;
    width: auto;
}"""

TEMPLATE_1_BODY = """
<div id="body-wrapper">
    <div class="center_column">
        <div class="title">
            <h1 class="header" odoo-set-text="header" odoo-set-text-color="header"></h1>
            <h2 class="subheader" odoo-set-text="subheader" odoo-set-text-color="subheader"></h2>
        </div>
        <div class="button_background rounded_button cta_button" odoo-render-if-any="button">
            <h1 odoo-set-text="button" odoo-set-text-color="button">button text</h1>
        </div>
    </div>
    <div class="footer">
        <div class="profile_section">
            <img
            odoo-set-src="image_1"
            alt="Profile Picture"
            width="128px"
            height="128px"
            odoo-render-if-any="image_1"
            />
            <div t-else=""></div>
            <div class="text_section">
                <span odoo-set-text="section_1" odoo-set-text-color="section_1"/>
                <div class="text_subsections">
                    <span odoo-set-text="subsection_1" odoo-set-text-color="subsection_1"/>
                    <span odoo-set-text="subsection_2" odoo-set-text-color="subsection_2"/>
                </div>
            </div>
        </div>
        <img
            odoo-set-src="image_2"
            alt="Profile Picture"
            height="auto"
            class="logo"
            odoo-render-if-any="image_2"
        />
    </div>
</div>
"""

TEMPLATE_2_STYLE = """
body {
    -webkit-box-align: center;
    align-items: center;
    justify-content: space-between;
}
.title {
    line-height: 4rem;
    width: 100%;
}
.footer {
    -webkit-box-align: center;
    align-items: center;
    height: 30%;
}
.cta_button {
    text-align: center;
    width: fit-content;
    max-height: 6rem;
}
.profile_section img {
    object-fit: cover;
    border-radius: 100px;
}
.profile_section .text_section {
    margin-left: 0.5rem;
}
.profile_section .text_section span {
    display: block;
}
.logo_line {
    width: 100%;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: horizontal;
    flex-direction: row;
    -webkit-box-align: center;
    align-items: center;
    align-content: center;
    -webkit-box-pack: end;
    justify-content: flex-end;
}
.logo {
    margin: 0.1rem;
    align-self: flex-end;
    max-height: 80px;
    width: auto;
}
"""
TEMPLATE_2_BODY = """
<div id="body-wrapper">
    <div class="logo_line">
        <img
            odoo-set-src="image_2"
            alt="Profile Picture"
            class="logo"
            odoo-render-if-any="image_2"
        />
    </div>
    <div class="title">
        <h1 class="header" odoo-set-text="header" odoo-set-text-color="header"></h1>
        <h2 class="subheader" odoo-set-text="subheader" odoo-set-text-color="subheader"></h2>
    </div>
    <div class="footer">
        <div class="profile_section">
            <img
                odoo-set-src="image_1"
                alt="Profile Picture"
                width="128px"
                height="128px"
                odoo-render-if-any="image_1"
            />
            <div t-else=""></div>
            <div class="text_section">
                <span odoo-set-text="section_1" odoo-set-text-color="section_1"/>
                <div class="text_subsections">
                    <span odoo-set-text="subsection_1" odoo-set-text-color="subsection_1"/>
                    <span odoo-set-text="subsection_2" odoo-set-text-color="subsection_2"/>
                </div>
            </div>
        </div>
        <div class="button_background rounded_button cta_button" odoo-render-if-any="button">
            <h1 odoo-set-text="button" odoo-set-text-color="button">button text</h1>
        </div>
    </div>
</div>
"""

TEMPLATE_3_STYLE = """
body {
    -webkit-box-pack: justify;
    justify-content: space-between;
}
.title {
    line-height: 4rem;
    width: 80%;
}
.footer {
    -webkit-box-align: end;
    align-items: flex-end;
    height: 50%;
}
.cta_button {
    text-align: center;
    width: 100%;
    max-width: 100%;
    max-height: 6rem;
}
.profile_image {
    object-fit: cover;
    border-radius: 100px;
}
.cta_section {
    max-width: 75%;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: vertical;
    flex-direction: column;
    -webkit-box-align: center;
    align-items: center;
    -webkit-box-pack: justify;
    justify-content: space-between;
}
.cta_section .text_section {
    width: 100%;
    font-size: 2.5rem;
}
.cta_section .text_subsections {
    font-size: 1.7rem;
}
.logo {
    position: absolute;
    right: 80px;
    top: 80px;
    max-height: 80px;
    width: auto;
}
"""

TEMPLATE_3_BODY = """
<div id="body-wrapper">
    <img
        odoo-set-src="image_2"
        alt="Profile Picture"
        class="logo"
        odoo-render-if-any="image_2"
    />
    <div class="title">
        <h2 class="subheader" odoo-set-text="subheader" odoo-set-text-color="subheader"></h2>
        <h1 class="header" odoo-set-text="header" odoo-set-text-color="header"></h1>
    </div>
    <div class="footer">
        <div class="cta_section">
            <div class="text_section">
                <span odoo-set-text="section_1" odoo-set-text-color="section_1"/>
                <div class="text_subsections">
                    <span odoo-set-text="subsection_1" odoo-set-text-color="subsection_1"/>
                    <span odoo-render-if-all="subsection_1,subsection_2">-</span>
                    <span odoo-set-text="subsection_2" odoo-set-text-color="subsection_2"/>
                </div>
            </div>
            <div class="button_background rounded_rectangle_button cta_button" odoo-render-if-any="button">
                <h1 odoo-set-text="button" odoo-set-text-color="button">button text</h1>
            </div>
        </div>
        <img
            class="profile_image"
            odoo-set-src="image_1"
            alt="Profile Picture"
            width="212px"
            height="212px"
            odoo-render-if-any="image_1"
        />
    </div>
</div>
"""

TEMPLATE_4_STYLE = """
body {
    justify-content: space-between;
}
.header {
    -webkit-line-clamp: 3;
    max-height: 4.5em;
    line-height: 1.2em;
}
.title {
    line-height: 4rem;
    width: 80%;
}
.footer {
    height: 50%;
}
.cta_button {
    text-align: center;
    max-height: 6rem;
}
.profile_image {
    object-fit: cover;
    border-radius: 100px;
}
.cta_section {
    max-width: 75%;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: vertical;
    flex-direction: column;
    -webkit-box-align: center;
    align-items: center;
}
.text_section {
    font-size: 2.5rem;
}
.text_subsections {
    font-size: 1.7rem;
}
.cta_button {
    width: fit-content;
}
.logo_line {
    width: 100%;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: horizontal;
    flex-direction: row;
    -webkit-box-align: center;
    align-items: center;
    align-content: center;
    -webkit-box-pack: start;
    justify-content: flex-start;
}
.logo {
    max-height: 80px;
    width: auto;
}
.profile_image {
    position: absolute;
    right: 80px;
    top: 80px;
}
"""

TEMPLATE_4_BODY = """
<div id="body-wrapper">
    <div class="logo_line">
        <img
            odoo-set-src="image_2"
            alt="Profile Picture"
            class="logo"
            odoo-render-if-any="image_2"
        />
    </div>
    <img
        class="profile_image"
        odoo-set-src="image_1"
        alt="Profile Picture"
        width="212px"
        height="212px"
        odoo-render-if-any="image_1"
    />
    <div class="title">
        <h2 class="subheader" odoo-set-text="subheader" odoo-set-text-color="subheader"></h2>
        <h1 class="header" odoo-set-text="header" odoo-set-text-color="header"></h1>
    </div>
    <div class="footer">
        <div class="text_section">
            <span odoo-set-text="section_1" odoo-set-text-color="section_1"/>
            <div class="text_subsections">
                <span odoo-set-text="subsection_1" odoo-set-text-color="subsection_1"/>
                <span odoo-render-if-all="subsection_1,subsection_2">-</span>
                <span odoo-set-text="subsection_2" odoo-set-text-color="subsection_2"/>
            </div>
        </div>
        <div class="button_background rounded_button cta_button" odoo-render-if-any="button">
            <h1 odoo-set-text="button" odoo-set-text-color="button">button text</h1>
        </div>
    </div>
</div>
"""

TEMPLATE_5_STYLE = """
body {
    height: 100%;
}
.title {
    line-height: 4rem;
    width: 80%;
}
.footer {
    margin-top: 5%;
    height: 40%;
}
.cta_button {
    text-align: center;
    max-height: 6rem;
}
.profile_image {
    object-fit: cover;
    border-radius: 100px;
}
.cta_section {
    max-width: 75%;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: vertical;
    flex-direction: column;
    -webkit-box-align: center;
    align-items: center;
}
.text_section {
    font-size: 2.5rem;
}
.text_subsections {
    height: 100%;
    font-size: 1.7rem;
}
.cta_button {
    width: fit-content;
    min-width: 30%;
    max-width: 50%;
}
.logo_line {
    width: 100%;
    display: -webkit-box;
    display: flex;
    -webkit-box-orient: horizontal;
    flex-direction: row;
    -webkit-box-align: center;
    align-items: center;
    align-content: center;
    -webkit-box-pack: justify;
    justify-content: space-between;
}
.logo {
    max-height: 80px;
    width: auto;
}
"""

TEMPLATE_5_BODY = """
<div id="body-wrapper">
    <div class="logo_line">
        <img
            class="profile_image"
            odoo-set-src="image_1"
            alt="Profile Picture"
            width="120px"
            height="120px"
            odoo-render-if-any="image_1"
        />
        <div class="button_background rounded_button cta_button" odoo-render-if-any="button">
            <h1 odoo-set-text="button" odoo-set-text-color="button">button text</h1>
        </div>
    </div>
    <div class="title">
        <h2 class="subheader" odoo-set-text="subheader" odoo-set-text-color="subheader"></h2>
        <h1 class="header" odoo-set-text="header" odoo-set-text-color="header"></h1>
    </div>
    <div class="footer">
        <div class="text_section">
            <span odoo-set-text="section_1" odoo-set-text-color="section_1"/>
            <div class="text_subsections">
                <span odoo-set-text="subsection_1" odoo-set-text-color="subsection_1"/>
                <span odoo-render-if-all="subsection_1,subsection_2">-</span>
                <span odoo-set-text="subsection_2" odoo-set-text-color="subsection_2"/>
            </div>
        </div>
        <img
            odoo-set-src="image_2"
            alt="Profile Picture"
            class="logo"
            odoo-render-if-any="image_2"
        />
    </div>
</div>
"""

VARIANT_DATA = {
    'common': {
        'style': COMMON_STYLE,
    },
    '1': {
        'body': TEMPLATE_1_BODY,
        'style': TEMPLATE_1_STYLE,
    },
    '2': {
        'body': TEMPLATE_2_BODY,
        'style': TEMPLATE_2_STYLE,
    },
    '3': {
        'body': TEMPLATE_3_BODY,
        'style': TEMPLATE_3_STYLE,
    },
    '4': {
        'body': TEMPLATE_4_BODY,
        'style': TEMPLATE_4_STYLE,
    },
    '5': {
        'body': TEMPLATE_5_BODY,
        'style': TEMPLATE_5_STYLE,
    },
}
